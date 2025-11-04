#!/bin/bash
# Script to help clean up old AWS infrastructure
# Use with caution - this lists resources, you must manually delete them

set -e

echo "🔍 Listing existing AWS resources..."
echo ""

echo "📦 ECS Clusters:"
aws ecs list-clusters --query 'clusterArns[*]' --output table || echo "No clusters found"

echo ""
echo "🐳 ECS Services:"
for cluster in $(aws ecs list-clusters --query 'clusterArns[*]' --output text); do
  echo "  Cluster: $cluster"
  aws ecs list-services --cluster "$cluster" --query 'serviceArns[*]' --output table || echo "  No services"
done

echo ""
echo "💾 RDS Instances:"
aws rds describe-db-instances --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceStatus]' --output table || echo "No RDS instances found"

echo ""
echo "🌐 Load Balancers:"
aws elbv2 describe-load-balancers --query 'LoadBalancers[*].[LoadBalancerName,State.Code]' --output table || echo "No load balancers found"

echo ""
echo "📤 ECR Repositories:"
aws ecr describe-repositories --query 'repositories[*].[repositoryName]' --output table || echo "No ECR repositories found"

echo ""
echo "🪣 S3 Buckets:"
aws s3 ls | grep -E "(financial|helper|crypto)" || echo "No matching S3 buckets found"

echo ""
echo "☁️  CloudFront Distributions:"
aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,DomainName]' --output table || echo "No CloudFront distributions found"

echo ""
echo "🔐 Secrets Manager:"
aws secretsmanager list-secrets --query 'SecretList[*].[Name]' --output table || echo "No secrets found"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  To delete resources:"
echo ""
echo "ECS Services:"
echo "  aws ecs update-service --cluster <cluster> --service <service> --desired-count 0"
echo "  aws ecs delete-service --cluster <cluster> --service <service>"
echo ""
echo "RDS:"
echo "  aws rds delete-db-instance --db-instance-identifier <id> --skip-final-snapshot"
echo ""
echo "Load Balancer:"
echo "  aws elbv2 delete-load-balancer --load-balancer-arn <arn>"
echo ""
echo "ECR Repository:"
echo "  aws ecr delete-repository --repository-name <name> --force"
echo ""
echo "S3 Bucket:"
echo "  aws s3 rb s3://<bucket-name> --force"
echo ""
echo "CloudFront:"
echo "  aws cloudfront delete-distribution --id <id> --if-match <etag>"
echo ""
echo "Or use Terraform destroy:"
echo "  cd infra/terraform && terraform destroy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"



