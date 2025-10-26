data "aws_iam_policy_document" "task_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Policy doc: allow the EXECUTION role to read our secrets for container injection
data "aws_iam_policy_document" "exec_can_read_secrets" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.github_app_id.arn,
      aws_secretsmanager_secret.github_private_key.arn,
      aws_secretsmanager_secret.openai.arn,
      aws_secretsmanager_secret.anthropic.arn,
      aws_secretsmanager_secret.repo_slug.arn,
      aws_secretsmanager_secret.issue_labels.arn,
      aws_secretsmanager_secret.policy_yaml.arn
    ]
  }
}

# Attach that policy to the EXECUTION role
resource "aws_iam_role_policy" "task_exec_read_secrets" {
  name   = "${var.project}-task-exec-read-secrets"
  role   = aws_iam_role.task_execution.id
  policy = data.aws_iam_policy_document.exec_can_read_secrets.json
}

resource "aws_iam_role" "task_execution" {
  name               = "${var.project}-task-exec"
  assume_role_policy = data.aws_iam_policy_document.task_assume.json
}

resource "aws_iam_role_policy_attachment" "task_exec_attach" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Task role with least privileges: read secrets + logs (logs are handled by exec role, but read for health if needed)
data "aws_iam_policy_document" "task_inline" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.github_app_id.arn,
      aws_secretsmanager_secret.github_private_key.arn,
      aws_secretsmanager_secret.openai.arn,
      aws_secretsmanager_secret.anthropic.arn,
      aws_secretsmanager_secret.repo_slug.arn,
      aws_secretsmanager_secret.issue_labels.arn,
      aws_secretsmanager_secret.policy_yaml.arn
    ]
  }
}

resource "aws_iam_role" "task_role" {
  name               = "${var.project}-task"
  assume_role_policy = data.aws_iam_policy_document.task_assume.json
}

resource "aws_iam_role_policy" "task_inline_attach" {
  name   = "${var.project}-task-inline"
  role   = aws_iam_role.task_role.id
  policy = data.aws_iam_policy_document.task_inline.json
}
