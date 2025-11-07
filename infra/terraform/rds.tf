# RDS PostgreSQL Database
# Using db.t3.micro for cost-effectiveness (free tier eligible or ~$15/month)

resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db-subnet-group"
  subnet_ids = [for subnet in aws_subnet.private : subnet.id]

  tags = {
    Name = "${var.project}-db-subnet-group"
  }
}

resource "aws_db_instance" "main" {
  identifier = "${var.project}-db"

  engine         = "postgres"
  engine_version = "16.10"
  instance_class = "db.t3.micro"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "mon:04:00-mon:05:00"

  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-db-final-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  deletion_protection        = var.enable_deletion_protection

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  performance_insights_enabled     = false

  publicly_accessible = false

  tags = {
    Name = "${var.project}-db"
  }
}

# Store DB password in Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name = "${var.project}-db-password"
  recovery_window_in_days = 0 # For cost savings in dev/staging
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id = aws_secretsmanager_secret.db_password.id
  secret_string = jsonencode({
    username    = var.db_username
    password    = random_password.db_password.result
    host        = aws_db_instance.main.endpoint
    port        = 5432
    dbname      = var.db_name
    DATABASE_URL = "postgresql://${var.db_username}:${random_password.db_password.result}@${aws_db_instance.main.endpoint}/${var.db_name}"
  })
}

