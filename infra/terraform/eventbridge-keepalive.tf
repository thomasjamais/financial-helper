# Optional: a daily “kick” that forces service to desired_count=1 (heals from accidental scale-to-0)
resource "aws_cloudwatch_event_rule" "daily" {
  count               = var.enable_keepalive ? 1 : 0
  name                = "${var.project}-daily-keepalive"
  schedule_expression = "rate(1 day)"
}

# (We’re disabling this until we wire a Lambda or RunTask target)
resource "aws_cloudwatch_event_target" "daily_target" {
  count     = var.enable_keepalive ? 1 : 0
  rule      = aws_cloudwatch_event_rule.daily[0].name
  target_id = "noop"
  arn       = aws_cloudwatch_event_rule.daily[0].arn
}
