resource "aws_cloudwatch_log_group" "agent" {
  name              = "/ecs/${var.project}-agent"
  retention_in_days = 14
}

output "log_group" {
  value = aws_cloudwatch_log_group.agent.name
}
