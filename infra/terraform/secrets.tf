# Secrets Manager for sensitive configuration

# Database password is created in rds.tf

# API Encryption Key
resource "aws_secretsmanager_secret" "api_enc_key" {
  name                    = "${var.project}-api-enc-key"
  recovery_window_in_days = 0 # For cost savings in dev/staging
}

resource "aws_secretsmanager_secret_version" "api_enc_key" {
  secret_id     = aws_secretsmanager_secret.api_enc_key.id
  secret_string = var.api_enc_key
}

# JWT Secrets
resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.project}-jwt-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = var.jwt_secret
}

resource "aws_secretsmanager_secret" "jwt_refresh_secret" {
  name                    = "${var.project}-jwt-refresh-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "jwt_refresh_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_refresh_secret.id
  secret_string = var.jwt_refresh_secret
}

# Bot Auth Credentials
resource "aws_secretsmanager_secret" "bot_auth_email" {
  name                    = "${var.project}-bot-auth-email"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "bot_auth_email" {
  secret_id     = aws_secretsmanager_secret.bot_auth_email.id
  secret_string = var.bot_auth_email
}

resource "aws_secretsmanager_secret" "bot_auth_password" {
  name                    = "${var.project}-bot-auth-password"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "bot_auth_password" {
  secret_id     = aws_secretsmanager_secret.bot_auth_password.id
  secret_string = var.bot_auth_password
}
