data "aws_iam_policy_document" "task_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# IAM roles and policies are now defined in ecs.tf for API and Bot services
# This file is kept for backwards compatibility but is not used by the new infrastructure
