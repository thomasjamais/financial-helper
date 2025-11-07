# Main infrastructure file - financial-helper AWS deployment
# This creates: Web (S3+CloudFront), API (ECS Fargate), Bot (ECS Fargate), DB (RDS)

terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    bucket = "financial-helper-terraform-state"
    key    = "terraform.tfstate"
    region = "eu-west-3"
    
    # Versioning and encryption configured via AWS CLI
  }
}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Random password for RDS
# RDS allows only printable ASCII except: '/', '@', '"', ' ' (space)
# So we exclude those and use a safe set of special characters
resource "random_password" "db_password" {
  length  = 32
  special = true
  
  # Override special characters to exclude: / @ " and space
  # Include only safe special chars that RDS allows
  override_special = "!#$%&*+-=?^_|~"
  
  # Ensure password meets complexity requirements
  min_upper   = 2
  min_lower   = 2
  min_numeric = 2
  min_special = 2
}

