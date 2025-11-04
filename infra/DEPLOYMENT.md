# AWS Deployment Guide for financial-helper

This guide walks you through deploying the financial-helper application to AWS using Terraform.

## Architecture Overview

- **Web**: S3 + CloudFront (static hosting, ~$1-5/month)
- **API**: ECS Fargate behind ALB (container hosting, ~$15/month)
- **Bot**: ECS Fargate (background service, ~$15/month)
- **Database**: RDS PostgreSQL db.t3.micro (~$15/month if not free tier)
- **Total**: ~$45-50/month (or ~$30/month if RDS free tier eligible)

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured (`aws configure`)
3. **Terraform** >= 1.6.0 installed
4. **Docker** installed (for building images locally if needed)
5. **GitHub Actions secrets** configured (for CI/CD)

## Step 1: Clean Up Old Infrastructure

If you have existing AWS resources, you may want to clean them up first:

```bash
# List existing resources
aws ec2 describe-instances
aws ecs list-clusters
aws rds describe-db-instances
aws s3 ls

# Manually delete old resources via AWS Console or CLI
```

## Step 2: Configure Terraform

1. **Create terraform.tfvars**:

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

2. **Edit terraform.tfvars** with your values:

```hcl
project = "financial-helper"
region  = "eu-west-3"

# Set secrets via environment variables (recommended)
# export TF_VAR_api_enc_key="your-key"
# export TF_VAR_jwt_secret="your-secret"
# export TF_VAR_jwt_refresh_secret="your-refresh-secret"
# export TF_VAR_bot_auth_email="bot@example.com"
# export TF_VAR_bot_auth_password="your-password"
```

3. **Generate secrets** (if you don't have them):

```bash
# Generate API encryption key
openssl rand -hex 32

# Generate JWT secrets
openssl rand -hex 64
```

4. **Set up Terraform backend** (optional, for state management):

Create an S3 bucket for Terraform state:
```bash
aws s3 mb s3://your-terraform-state-bucket
aws s3api put-bucket-versioning \
  --bucket your-terraform-state-bucket \
  --versioning-configuration Status=Enabled
```

Update `main.tf` backend configuration:
```hcl
backend "s3" {
  bucket = "your-terraform-state-bucket"
  key    = "financial-helper/terraform.tfstate"
  region = "eu-west-3"
}
```

## Step 3: Deploy Infrastructure

1. **Initialize Terraform**:

```bash
cd infra/terraform
terraform init
```

2. **Plan the deployment**:

```bash
terraform plan
```

Review the plan carefully. It should create:
- VPC, subnets, NAT gateway
- RDS PostgreSQL database
- ECS cluster, task definitions, services
- Application Load Balancer
- ECR repositories
- S3 bucket and CloudFront distribution
- Security groups and IAM roles

3. **Apply the infrastructure**:

```bash
terraform apply
```

This will take 10-15 minutes. It will:
- Create networking resources
- Create RDS database (longest step)
- Create ECS cluster and services
- Create ALB and CloudFront

4. **Save outputs**:

```bash
terraform output -json > outputs.json
```

Important outputs:
- `api_url`: Your API endpoint
- `web_url`: Your CloudFront URL (may take a few minutes to provision)
- `database_endpoint`: RDS connection string
- `ecr_api_url` and `ecr_bot_url`: ECR repository URLs

## Step 4: Build and Push Docker Images

1. **Build API image**:

```bash
# Get ECR login token
aws ecr get-login-password --region eu-west-3 | docker login --username AWS --password-stdin $(aws ecr describe-repositories --repository-names financial-helper-api --query 'repositories[0].repositoryUri' --output text | cut -d'/' -f1)

# Build and push
docker build -t financial-helper-api:latest -f apps/api/Dockerfile .
docker tag financial-helper-api:latest $(terraform output -raw ecr_api_url):latest
docker push $(terraform output -raw ecr_api_url):latest
```

2. **Build Bot image**:

```bash
docker build -t financial-helper-bot:latest -f apps/bot/Dockerfile .
docker tag financial-helper-bot:latest $(terraform output -raw ecr_bot_url):latest
docker push $(terraform output -raw ecr_bot_url):latest
```

## Step 5: Configure Secrets

1. **Database password** is automatically stored in AWS Secrets Manager

2. **Get database connection string**:

```bash
aws secretsmanager get-secret-value \
  --secret-id financial-helper-db-password \
  --query SecretString \
  --output text | jq -r '.password'
```

3. **Update ECS services** to use the correct image tags:

```bash
# Update API service
aws ecs update-service \
  --cluster financial-helper-cluster \
  --service financial-helper-api \
  --force-new-deployment

# Update Bot service
aws ecs update-service \
  --cluster financial-helper-cluster \
  --service financial-helper-bot \
  --force-new-deployment
```

## Step 6: Deploy Web Assets

1. **Build web app**:

```bash
cd apps/web
pnpm install
pnpm build
```

2. **Upload to S3**:

```bash
aws s3 sync dist/ s3://$(terraform output -raw s3_web_bucket) --delete
```

3. **Invalidate CloudFront cache** (optional):

```bash
aws cloudfront create-invalidation \
  --distribution-id $(aws cloudfront list-distributions --query "DistributionList.Items[?Origins.Items[0].DomainName=='$(terraform output -raw s3_web_bucket).s3-website.eu-west-3.amazonaws.com'].Id" --output text) \
  --paths "/*"
```

## Step 7: Configure GitHub Actions (Auto-Deployment)

1. **Add GitHub Secrets**:

Go to your repository → Settings → Secrets and variables → Actions

Add these secrets:
- `AWS_ACCESS_KEY_ID`: Your AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
- `AWS_S3_WEB_BUCKET`: S3 bucket name (from Terraform output)
- `AWS_CLOUDFRONT_DISTRIBUTION_ID`: CloudFront distribution ID (optional)

2. **GitHub Actions will automatically**:
   - Build and test on every push to `main`
   - Build Docker images
   - Push to ECR
   - Deploy to ECS
   - Deploy web assets to S3

## Step 8: Verify Deployment

1. **Check API health**:

```bash
curl http://$(terraform output -raw api_url)/healthz
```

2. **Check ECS services**:

```bash
aws ecs describe-services \
  --cluster financial-helper-cluster \
  --services financial-helper-api financial-helper-bot
```

3. **Check CloudWatch logs**:

```bash
aws logs tail /ecs/financial-helper-api --follow
aws logs tail /ecs/financial-helper-bot --follow
```

4. **Access web application**:

Open `https://$(terraform output -raw web_url)` in your browser

## Troubleshooting

### ECS Tasks Not Starting

1. Check CloudWatch logs for errors
2. Verify secrets are correctly configured in Secrets Manager
3. Check security group rules allow necessary traffic
4. Verify ECR images exist and are accessible

### Database Connection Issues

1. Verify RDS security group allows traffic from ECS security group
2. Check database endpoint is correct
3. Verify credentials in Secrets Manager
4. Check RDS instance status: `aws rds describe-db-instances`

### Web Assets Not Loading

1. Verify S3 bucket policy allows CloudFront access
2. Check CloudFront distribution status
3. Verify index.html exists in S3 root
4. Check CORS configuration if API calls fail

### Cost Optimization

- Use RDS free tier if eligible (first 12 months)
- Scale down `api_desired_count` and `bot_desired_count` to 1
- Use smaller instance types if needed
- Enable CloudWatch log retention (currently 7 days)
- Consider using Spot instances for non-critical workloads

## Clean Up (Destroy Infrastructure)

⚠️ **Warning**: This will delete all resources including the database!

```bash
cd infra/terraform
terraform destroy
```

## Next Steps

1. **Set up HTTPS**: Configure ACM certificate and update ALB listener
2. **Enable monitoring**: Set up CloudWatch alarms
3. **Backup strategy**: Configure RDS automated backups
4. **CI/CD improvements**: Add staging environment, blue-green deployments
5. **Auto-scaling**: Configure ECS auto-scaling based on CPU/memory

## Support

For issues or questions, check:
- CloudWatch logs
- ECS service events
- RDS event subscriptions
- Terraform state



