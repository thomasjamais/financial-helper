resource "aws_ecs_cluster" "this" {
  name = "${var.project}-cluster"
}

# Resolve latest image at deploy-time; you will push to this ECR.
locals {
  image = "${aws_ecr_repository.agent.repository_url}:${var.agent_image_tag}"
}

resource "aws_ecs_task_definition" "agent" {
  family                   = "${var.project}-agent"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.fargate_cpu
  memory                   = var.fargate_mem
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task_role.arn
  container_definitions = jsonencode([
    {
      "name" : "agent",
      "image" : local.image,
      "essential" : true,
      "environment" : [
        { "name" : "LOG_LEVEL", "value" : "info" }
      ],
      "secrets" : [
        { "name" : "GITHUB_APP_ID", "valueFrom" : aws_secretsmanager_secret.github_app_id.arn },
        { "name" : "GITHUB_PRIVATE_KEY", "valueFrom" : aws_secretsmanager_secret.github_private_key.arn },
        { "name" : "OPENAI_API_KEY", "valueFrom" : aws_secretsmanager_secret.openai.arn },
        { "name" : "ANTHROPIC_API_KEY", "valueFrom" : aws_secretsmanager_secret.anthropic.arn },
        { "name" : "REPO_SLUG", "valueFrom" : aws_secretsmanager_secret.repo_slug.arn },
        { "name" : "ISSUE_LABELS", "valueFrom" : aws_secretsmanager_secret.issue_labels.arn },
        { "name" : "POLICY_YAML", "valueFrom" : aws_secretsmanager_secret.policy_yaml.arn }
      ],
      "logConfiguration" : {
        "logDriver" : "awslogs",
        "options" : {
          "awslogs-group" : "${aws_cloudwatch_log_group.agent.name}",
          "awslogs-region" : "${var.region}",
          "awslogs-stream-prefix" : "ecs"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "agent" {
  name            = "${var.project}-agent-svc"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.agent.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = [for s in aws_subnet.public : s.id]
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = true
  }

  lifecycle {
    ignore_changes = [task_definition] # so you can push new image tags without TF churn
  }
}
