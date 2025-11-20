# Infrastructure Outputs

output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC ID"
}

output "api_url" {
  value       = "http://${aws_lb.api.dns_name}"
  description = "API URL (via ALB)"
}

output "web_url" {
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"
  description = "Web URL (via CloudFront)"
}

output "database_endpoint" {
  value       = aws_db_instance.main.endpoint
  description = "RDS database endpoint"
  sensitive   = true
}

output "database_secret_arn" {
  value       = aws_secretsmanager_secret.db_password.arn
  description = "Database credentials secret ARN"
  sensitive   = true
}

# ECR outputs are defined in ecr.tf

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.main.name
  description = "ECS cluster name"
}

output "api_service_name" {
  value       = aws_ecs_service.api.name
  description = "API service name"
}

output "bot_service_name" {
  value       = aws_ecs_service.bot.name
  description = "Bot service name"
}

output "s3_web_bucket" {
  value       = aws_s3_bucket.web.id
  description = "S3 bucket for web assets"
}

output "nat_gateway_public_ip" {
  value       = aws_eip.nat.public_ip
  description = "NAT Gateway public IP (use this IP for exchange API whitelisting: Binance, Bitget, etc.)"
}
