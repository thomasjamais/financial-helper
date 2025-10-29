#!/bin/bash

# Build and deploy AI agents to ECR
set -e

AWS_REGION=${AWS_REGION:-eu-west-3}
ECR_REPO=${ECR_REPO:-financial-helper-agent}
AWS_ACCOUNT_ID=641870364246

echo "Building and deploying AI agents..."

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Build programmer agent
echo "Building programmer agent..."
docker build -f agent/Dockerfile -t programmer-agent:latest .
docker tag programmer-agent:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:programmer-agent-latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:programmer-agent-latest

# Build product agent
echo "Building product agent..."
docker build -f agent/Dockerfile.product -t product-agent:latest .
docker tag product-agent:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:product-agent-latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:product-agent-latest

# Build CEO agent
echo "Building CEO agent..."
docker build -f agent/Dockerfile.ceo -t ceo-agent:latest .
docker tag ceo-agent:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:ceo-agent-latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:ceo-agent-latest

echo "✅ Both agents deployed successfully!"

# Update ECS task definitions
echo "Updating ECS task definitions..."
aws ecs register-task-definition --cli-input-json file://infra/ecs-task-definitions/programmer-agent.json --region $AWS_REGION
aws ecs register-task-definition --cli-input-json file://infra/ecs-task-definitions/product-agent.json --region $AWS_REGION
aws ecs register-task-definition --cli-input-json file://infra/ecs-task-definitions/ceo-agent.json --region $AWS_REGION

echo "🎉 Deployment complete!"
