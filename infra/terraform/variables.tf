# Infrastructure Variables for financial-helper AWS deployment

variable "project" {
  type        = string
  description = "Project name (used for resource naming)"
  default     = "financial-helper"
}

variable "region" {
  type        = string
  description = "AWS region"
  default     = "eu-west-3" # Paris - good pricing
}

variable "vpc_cidr" {
  type        = string
  description = "VPC CIDR block"
  default     = "10.60.0.0/16"
}

variable "public_subnets" {
  type        = list(string)
  description = "Public subnet CIDR blocks"
  default     = ["10.60.1.0/24", "10.60.2.0/24"]
}

variable "private_subnets" {
  type        = list(string)
  description = "Private subnet CIDR blocks"
  default     = ["10.60.10.0/24", "10.60.11.0/24"]
}

# Database Configuration
variable "db_name" {
  type        = string
  description = "Database name"
  default     = "financial_helper"
}

variable "db_username" {
  type        = string
  description = "Database master username"
  default     = "financial"
}

# ECS Configuration
variable "api_desired_count" {
  type        = number
  description = "Desired number of API tasks"
  default     = 1
}

variable "bot_desired_count" {
  type        = number
  description = "Desired number of Bot tasks"
  default     = 1
}

variable "api_image_tag" {
  type        = string
  description = "API Docker image tag"
  default     = "latest"
}

variable "bot_image_tag" {
  type        = string
  description = "Bot Docker image tag"
  default     = "latest"
}

# Secrets (should be set via terraform.tfvars or environment variables)
variable "api_enc_key" {
  type        = string
  description = "API encryption key (for encrypting exchange API keys)"
  sensitive   = true
}

variable "jwt_secret" {
  type        = string
  description = "JWT secret for access tokens"
  sensitive   = true
}

variable "jwt_refresh_secret" {
  type        = string
  description = "JWT secret for refresh tokens"
  sensitive   = true
}

variable "bot_auth_email" {
  type        = string
  description = "Bot authentication email"
  sensitive   = true
}

variable "bot_auth_password" {
  type        = string
  description = "Bot authentication password"
  sensitive   = true
}

# Operational Settings
variable "log_level" {
  type        = string
  description = "Log level (debug, info, warn, error)"
  default     = "info"
}

variable "enable_deletion_protection" {
  type        = bool
  description = "Enable deletion protection for critical resources"
  default     = false # Set to true in production
}
