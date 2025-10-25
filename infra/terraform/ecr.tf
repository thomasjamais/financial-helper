resource "aws_ecr_repository" "agent" {
  name                 = "${var.project}-agent"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  tags = { Name = "${var.project}-agent" }
}

output "ecr_repository_url" {
  value = aws_ecr_repository.agent.repository_url
}
