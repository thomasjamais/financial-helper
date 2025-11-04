# AWS Deployment for financial-helper

Complete AWS infrastructure setup for deploying financial-helper on AWS with auto-deployment via GitHub Actions.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Internet                            │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │   CloudFront (CDN)      │
        │   Web Assets            │
        └────────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │   S3 Bucket            │
        │   Static Web Files     │
        └────────────────────────┘

        ┌────────────────────────┐
        │   ALB (HTTP/HTTPS)     │
        └────────────┬───────────┘
                     │
        ┌────────────┴────────────┐
        │   ECS Fargate           │
        │   ┌────────┬─────────┐  │
        │   │  API  │   Bot   │  │
        │   └────┬──┴────┬────┘  │
        └────────┼────────┼───────┘
                 │        │
        ┌────────┴────────┴───────┐
        │   RDS PostgreSQL        │
        │   db.t3.micro           │
        └────────────────────────┘
```

## 💰 Cost Estimate

- **S3 + CloudFront**: ~$1-5/month (first 1TB transfer free)
- **ECS Fargate (API)**: ~$15/month (0.5 vCPU, 1GB, 1 task)
- **ECS Fargate (Bot)**: ~$15/month (0.5 vCPU, 1GB, 1 task)
- **RDS PostgreSQL**: ~$15/month (db.t3.micro, or free tier eligible)
- **ALB**: ~$16/month (Application Load Balancer)
- **NAT Gateway**: ~$32/month (for private subnet internet access)
- **Data Transfer**: Variable based on usage

**Total**: ~$100-120/month (or ~$85/month without NAT Gateway if using public subnets)

**With Optimizations**:
- Use public subnets for ECS (remove NAT Gateway): -$32/month
- Use RDS free tier (if eligible): -$15/month
- **Optimized Total**: ~$55-70/month

## 🚀 Quick Start

1. **Clean up old infrastructure**:
   ```bash
   ./infra/cleanup-old.sh
   ```

2. **Configure Terraform**:
   ```bash
   cd infra/terraform
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your values
   ```

3. **Set secrets**:
   ```bash
   export TF_VAR_api_enc_key="$(openssl rand -hex 32)"
   export TF_VAR_jwt_secret="$(openssl rand -hex 64)"
   export TF_VAR_jwt_refresh_secret="$(openssl rand -hex 64)"
   export TF_VAR_bot_auth_email="your-bot@email.com"
   export TF_VAR_bot_auth_password="your-password"
   ```

4. **Deploy infrastructure**:
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

5. **Configure GitHub Actions**:
   - Go to repository Settings → Secrets
   - Add: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
   - Add: `AWS_S3_WEB_BUCKET` (from Terraform output)
   - Add: `AWS_CLOUDFRONT_DISTRIBUTION_ID` (optional)

6. **Push to main branch**:
   ```bash
   git push origin main
   ```

GitHub Actions will automatically:
- ✅ Build and test
- ✅ Build Docker images
- ✅ Push to ECR
- ✅ Deploy to ECS
- ✅ Deploy web assets to S3

## 📚 Documentation

See [infra/DEPLOYMENT.md](infra/DEPLOYMENT.md) for detailed deployment instructions.

## 🔧 Manual Deployment (if needed)

### Build and Push Images

```bash
# API
docker build -t financial-helper-api:latest -f apps/api/Dockerfile .
docker tag financial-helper-api:latest $(terraform output -raw ecr_api_url):latest
docker push $(terraform output -raw ecr_api_url):latest

# Bot
docker build -t financial-helper-bot:latest -f apps/bot/Dockerfile .
docker tag financial-helper-bot:latest $(terraform output -raw ecr_bot_url):latest
docker push $(terraform output -raw ecr_bot_url):latest
```

### Deploy Web Assets

```bash
cd apps/web
pnpm install && pnpm build
aws s3 sync dist/ s3://$(terraform output -raw s3_web_bucket) --delete
```

### Update ECS Services

```bash
# API
aws ecs update-service \
  --cluster financial-helper-cluster \
  --service financial-helper-api \
  --force-new-deployment

# Bot
aws ecs update-service \
  --cluster financial-helper-cluster \
  --service financial-helper-bot \
  --force-new-deployment
```

## 🧹 Cleanup

To destroy all infrastructure:

```bash
cd infra/terraform
terraform destroy
```

⚠️ **Warning**: This will delete everything including the database!

## 📝 Notes

- First deployment takes ~15 minutes (RDS creation is slow)
- CloudFront distribution may take 15-20 minutes to become available
- Make sure to backup your database before destroying infrastructure
- For production, enable `deletion_protection = true` in terraform.tfvars



