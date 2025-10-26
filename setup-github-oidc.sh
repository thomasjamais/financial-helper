# Create GitHub Actions OIDC Provider and Role
# Run these commands to set up GitHub Actions integration

# 1. Create OIDC Provider (if not exists)
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --region eu-west-3

# 2. Create Trust Policy for GitHub Actions
cat > github-actions-trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::641870364246:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:thomasjamais/financial-helper:*"
        }
      }
    }
  ]
}
EOF

# 3. Create GitHub Actions Role
aws iam create-role \
  --role-name financial-helper-github-actions \
  --assume-role-policy-document file://github-actions-trust-policy.json \
  --region eu-west-3

# 4. Attach ECS Task Execution Policy
aws iam attach-role-policy \
  --role-name financial-helper-github-actions \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
  --region eu-west-3

# 5. Create and attach custom policy for ECS RunTask
cat > github-actions-ecs-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:RunTask",
        "ecs:StopTask",
        "ecs:DescribeTasks",
        "ecs:DescribeTaskDefinition"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": [
        "arn:aws:iam::641870364246:role/financial-helper-task-exec",
        "arn:aws:iam::641870364246:role/financial-helper-task"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name financial-helper-github-actions \
  --policy-name ECSRunTaskPolicy \
  --policy-document file://github-actions-ecs-policy.json \
  --region eu-west-3

echo "✅ GitHub Actions OIDC setup complete!"
echo "Role ARN: arn:aws:iam::641870364246:role/financial-helper-github-actions"
