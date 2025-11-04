# ECR Repositories for Docker images

resource "aws_ecr_repository" "api" {
  name                 = "${var.project}-api"
  image_tag_mutability = "MUTABLE"
  
  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = "${var.project}-api"
  }
}

resource "aws_ecr_repository" "bot" {
  name                 = "${var.project}-bot"
  image_tag_mutability = "MUTABLE"
  
  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = "${var.project}-bot"
  }
}

output "ecr_api_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecr_bot_url" {
  value = aws_ecr_repository.bot.repository_url
}
