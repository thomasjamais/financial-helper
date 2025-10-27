#!/bin/bash
set -e

echo "🚀 Complete AI Agent Deployment Script"
echo "====================================="

# Configuration
AWS_REGION=${AWS_REGION:-eu-west-3}
ECR_REPO=${ECR_REPO:-financial-helper-agent}
AWS_ACCOUNT_ID=641870364246

echo "📋 Configuration:"
echo "  AWS Region: $AWS_REGION"
echo "  ECR Repo: $ECR_REPO"
echo "  AWS Account: $AWS_ACCOUNT_ID"
echo ""

# Step 1: Build and push Docker images
echo "🐳 Step 1: Building Docker images..."
docker build --no-cache -f agent/Dockerfile -t programmer-agent:latest .
docker build --no-cache -f agent/Dockerfile.product -t product-agent:latest .

echo "📤 Step 2: Pushing to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Push with specific tags to avoid caching issues
docker tag programmer-agent:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:programmer-$(date +%s)
docker tag product-agent:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:product-$(date +%s)

PROGRAMMER_TAG="programmer-$(date +%s)"
PRODUCT_TAG="product-$(date +%s)"

docker tag programmer-agent:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$PROGRAMMER_TAG
docker tag product-agent:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$PRODUCT_TAG

docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$PROGRAMMER_TAG
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$PRODUCT_TAG

echo "✅ Images pushed with tags: $PROGRAMMER_TAG, $PRODUCT_TAG"

# Step 3: Update task definitions with new image tags
echo "📝 Step 3: Updating task definitions..."

# Update programmer task definition
PROGRAMMER_TASK_DEF=$(cat infra/ecs-task-definitions/programmer-agent.json | jq --arg image "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$PROGRAMMER_TAG" '.containerDefinitions[0].image = $image')
echo "$PROGRAMMER_TASK_DEF" > /tmp/programmer-agent-updated.json

# Update product task definition  
PRODUCT_TASK_DEF=$(cat infra/ecs-task-definitions/product-agent.json | jq --arg image "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$PRODUCT_TAG" '.containerDefinitions[0].image = $image')
echo "$PRODUCT_TASK_DEF" > /tmp/product-agent-updated.json

# Step 4: Register task definitions
echo "📋 Step 4: Registering task definitions..."
PROGRAMMER_REVISION=$(aws ecs register-task-definition --cli-input-json file:///tmp/programmer-agent-updated.json --region $AWS_REGION --query 'taskDefinition.revision' --output text)
PRODUCT_REVISION=$(aws ecs register-task-definition --cli-input-json file:///tmp/product-agent-updated.json --region $AWS_REGION --query 'taskDefinition.revision' --output text)

echo "✅ Task definitions registered:"
echo "  Programmer: financial-helper-programmer-agent:$PROGRAMMER_REVISION"
echo "  Product: financial-helper-product-agent:$PRODUCT_REVISION"

# Step 5: Generate GitHub secrets update script
echo "🔑 Step 5: Generating GitHub secrets update script..."
cat > update-github-secrets.sh << EOF
#!/bin/bash
echo "🔑 Update these GitHub repository secrets:"
echo "=========================================="
echo ""
echo "Go to: https://github.com/thomasjamais/financial-helper/settings/secrets/actions"
echo ""
echo "Update these secrets:"
echo "PROGRAMMER_TASK_DEFINITION=financial-helper-programmer-agent:$PROGRAMMER_REVISION"
echo "PRODUCT_TASK_DEFINITION=financial-helper-product-agent:$PRODUCT_REVISION"
echo ""
echo "Other secrets (should already be set):"
echo "AWS_ACCESS_KEY_ID=[YOUR_ACCESS_KEY_ID]"
echo "AWS_SECRET_ACCESS_KEY=[YOUR_SECRET_ACCESS_KEY]"
echo "AWS_REGION=eu-west-3"
echo "ECS_CLUSTER=financial-helper-cluster"
echo "SUBNET_IDS=subnet-0480c0bbbb272c7f3,subnet-09e259a38907a945d"
echo "SECURITY_GROUP_IDS=sg-055ceedf4e4a2781d"
echo ""
echo "After updating secrets, test by:"
echo "1. Go to https://github.com/thomasjamais/financial-helper/issues/2"
echo "2. Remove 'ai' label"
echo "3. Add 'ai' label back"
echo "4. Watch logs: aws logs tail '/ecs/financial-helper-agent' --region eu-west-3 --follow"
EOF

chmod +x update-github-secrets.sh

echo ""
echo "🎉 Deployment Complete!"
echo "======================"
echo ""
echo "Next steps:"
echo "1. Run: ./update-github-secrets.sh"
echo "2. Update GitHub secrets as shown"
echo "3. Test the workflow"
echo ""
echo "Current task definition revisions:"
echo "  Programmer: financial-helper-programmer-agent:$PROGRAMMER_REVISION"
echo "  Product: financial-helper-product-agent:$PRODUCT_REVISION"
