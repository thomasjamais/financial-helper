resource "aws_secretsmanager_secret" "github_app_id" {
  name = "${var.project}/github_app_id"
}

resource "aws_secretsmanager_secret_version" "github_app_id_v" {
  secret_id     = aws_secretsmanager_secret.github_app_id.id
  secret_string = var.github_app_id
}

resource "aws_secretsmanager_secret" "github_private_key" {
  name = "${var.project}/github_private_key_pem"
}

resource "aws_secretsmanager_secret_version" "github_private_key_v" {
  secret_id     = aws_secretsmanager_secret.github_private_key.id
  secret_string = var.github_private_key_pem
}

# OPENAI
resource "aws_secretsmanager_secret" "openai" {
  name = "${var.project}/openai_api_key"
}
resource "aws_secretsmanager_secret_version" "openai_v" {
  count         = length(var.openai_api_key) > 0 ? 1 : 0
  secret_id     = aws_secretsmanager_secret.openai.id
  secret_string = var.openai_api_key
}

# ANTHROPIC
resource "aws_secretsmanager_secret" "anthropic" {
  name = "${var.project}/anthropic_api_key"
}
resource "aws_secretsmanager_secret_version" "anthropic_v" {
  count         = length(var.anthropic_api_key) > 0 ? 1 : 0
  secret_id     = aws_secretsmanager_secret.anthropic.id
  secret_string = var.anthropic_api_key
}

resource "aws_secretsmanager_secret" "repo_slug" {
  name = "${var.project}/github_repo_slug"
}
resource "aws_secretsmanager_secret_version" "repo_slug_v" {
  secret_id     = aws_secretsmanager_secret.repo_slug.id
  secret_string = var.github_repo_slug
}

resource "aws_secretsmanager_secret" "issue_labels" {
  name = "${var.project}/github_issue_labels"
}
resource "aws_secretsmanager_secret_version" "issue_labels_v" {
  secret_id     = aws_secretsmanager_secret.issue_labels.id
  secret_string = var.github_issue_labels
}

resource "aws_secretsmanager_secret" "policy_yaml" {
  name = "${var.project}/agent_policy_yaml"
}
resource "aws_secretsmanager_secret_version" "policy_yaml_v" {
  secret_id     = aws_secretsmanager_secret.policy_yaml.id
  secret_string = var.agent_policy_yaml
}

output "secrets_arns" {
  value = {
    github_app_id       = aws_secretsmanager_secret.github_app_id.arn
    github_private_key  = aws_secretsmanager_secret.github_private_key.arn
    openai_api_key      = aws_secretsmanager_secret.openai.arn
    anthropic_api_key   = aws_secretsmanager_secret.anthropic.arn
    github_repo_slug    = aws_secretsmanager_secret.repo_slug.arn
    github_issue_labels = aws_secretsmanager_secret.issue_labels.arn
    agent_policy_yaml   = aws_secretsmanager_secret.policy_yaml.arn
  }
}
