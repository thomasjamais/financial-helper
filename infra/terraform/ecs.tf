# ECS Cluster and Services for API and Bot

resource "aws_ecs_cluster" "main" {
  name = "${var.project}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project}-cluster"
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.project}-api"
  retention_in_days = 7

  tags = {
    Name = "${var.project}-api-logs"
  }
}

resource "aws_cloudwatch_log_group" "bot" {
  name              = "/ecs/${var.project}-bot"
  retention_in_days = 7

  tags = {
    Name = "${var.project}-bot-logs"
  }
}

# ECS Task Execution Role (updated to include RDS secrets)
resource "aws_iam_role" "ecs_execution" {
  name = "${var.project}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow ECS execution role to read secrets
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${var.project}-ecs-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.db_password.arn,
          aws_secretsmanager_secret.api_enc_key.arn,
          aws_secretsmanager_secret.jwt_secret.arn,
          aws_secretsmanager_secret.jwt_refresh_secret.arn
        ]
      }
    ]
  })
}

# ECS Task Role
resource "aws_iam_role" "ecs_task" {
  name = "${var.project}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

# API Task Definition
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512  # 0.5 vCPU
  memory                   = 1024 # 1 GB
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}"

      essential = true

      portMappings = [
        {
          containerPort = 8080
          protocol      = "tcp"
        }
      ]

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "8080" },
        { name = "LOG_LEVEL", value = var.log_level }
      ]

      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${aws_secretsmanager_secret.db_password.arn}:DATABASE_URL::"
        },
        {
          name      = "API_ENC_KEY"
          valueFrom = aws_secretsmanager_secret.api_enc_key.arn
        },
        {
          name      = "JWT_SECRET"
          valueFrom = aws_secretsmanager_secret.jwt_secret.arn
        },
        {
          name      = "JWT_REFRESH_SECRET"
          valueFrom = aws_secretsmanager_secret.jwt_refresh_secret.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = {
    Name = "${var.project}-api-task"
  }
}

# Bot Task Definition
resource "aws_ecs_task_definition" "bot" {
  family                   = "${var.project}-bot"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512  # 0.5 vCPU
  memory                   = 1024 # 1 GB
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "bot"
      image = "${aws_ecr_repository.bot.repository_url}:${var.bot_image_tag}"

      essential = true

      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "LOG_LEVEL", value = var.log_level },
        { name = "BOT_INTERVAL_MS", value = "300000" }, # 5 minutes
        { name = "API_BASE_URL", value = "http://${aws_lb.api.dns_name}" },
        { name = "TECHNICAL_ANALYSIS_ENABLED", value = "true" },
        { name = "TECHNICAL_ANALYSIS_SYMBOLS_COUNT", value = "50" },
        { name = "MIN_CONFIDENCE_SCORE", value = "0.6" }
      ]

      secrets = [
        {
          name      = "AUTH_EMAIL"
          valueFrom = aws_secretsmanager_secret.bot_auth_email.arn
        },
        {
          name      = "AUTH_PASSWORD"
          valueFrom = aws_secretsmanager_secret.bot_auth_password.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.bot.name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = {
    Name = "${var.project}-bot-task"
  }
}

# API Service
resource "aws_ecs_service" "api" {
  name            = "${var.project}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [for subnet in aws_subnet.private : subnet.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8080
  }

  depends_on = [aws_lb.api, aws_lb_listener.api_http]

  health_check_grace_period_seconds = 60

  # deployment_configuration uses defaults (max 200%, min 100%)
  # If needed, configure via AWS Console or use different syntax for your provider version

  lifecycle {
    ignore_changes = [task_definition]
  }

  tags = {
    Name = "${var.project}-api-service"
  }
}

# Bot Service
resource "aws_ecs_service" "bot" {
  name            = "${var.project}-bot"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.bot.arn
  desired_count   = var.bot_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [for subnet in aws_subnet.private : subnet.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  # deployment_configuration uses defaults (max 200%, min 100%)
  # If needed, configure via AWS Console or use different syntax for your provider version

  lifecycle {
    ignore_changes = [task_definition]
  }

  tags = {
    Name = "${var.project}-bot-service"
  }
}
