#!/bin/bash

# Verify GitHub Actions OIDC and ECS setup
echo "🔍 Verifying GitHub Actions OIDC Setup..."

# Check if the GitHub Actions role exists
echo "1. Checking GitHub Actions role..."
aws iam get-role --role-name financial-helper-github-actions --region eu-west-3 --query 'Role.RoleName' --output text 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ GitHub Actions role exists"
else
    echo "❌ GitHub Actions role not found"
    exit 1
fi

# Check if OIDC provider exists
echo "2. Checking OIDC provider..."
aws iam get-open-id-connect-provider --open-id-connect-provider-arn "arn:aws:iam::641870364246:oidc-provider/token.actions.githubusercontent.com" --region eu-west-3 --query 'Url' --output text 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ OIDC provider exists"
else
    echo "❌ OIDC provider not found"
    exit 1
fi

# Check ECS cluster
echo "3. Checking ECS cluster..."
aws ecs describe-clusters --clusters financial-helper-cluster --region eu-west-3 --query 'clusters[0].status' --output text 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ ECS cluster exists"
else
    echo "❌ ECS cluster not found"
    exit 1
fi

# Check task definitions
echo "4. Checking task definitions..."
aws ecs describe-task-definition --task-definition financial-helper-programmer-agent --region eu-west-3 --query 'taskDefinition.status' --output text 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Programmer agent task definition exists"
else
    echo "❌ Programmer agent task definition not found"
fi

aws ecs describe-task-definition --task-definition financial-helper-product-agent --region eu-west-3 --query 'taskDefinition.status' --output text 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Product agent task definition exists"
else
    echo "❌ Product agent task definition not found"
fi

echo ""
echo "📋 Required GitHub Secrets:"
echo "AWS_ROLE_ARN=arn:aws:iam::641870364246:role/financial-helper-github-actions"
echo "AWS_REGION=eu-west-3"
echo "ECS_CLUSTER=financial-helper-cluster"
echo "PROGRAMMER_TASK_DEFINITION=financial-helper-programmer-agent:latest"
echo "PRODUCT_TASK_DEFINITION=financial-helper-product-agent:latest"
echo "SUBNET_IDS=subnet-0480c0bbbb272c7f3,subnet-09e259a38907a945d"
echo "SECURITY_GROUP_IDS=sg-055ceedf4e4a2781d"
echo ""
echo "🎯 Next steps:"
echo "1. Verify all secrets are set in GitHub repository settings"
echo "2. Test the workflow by removing and re-adding the 'ai' label to issue #2"
echo "3. Check the Actions tab for workflow execution"
