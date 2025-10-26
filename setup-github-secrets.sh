#!/bin/bash

# Setup script for GitHub Actions with AWS access keys
echo "🔑 Setting up GitHub Actions with AWS access keys..."

echo ""
echo "📋 Add these secrets to your GitHub repository:"
echo "Go to: https://github.com/thomasjamais/financial-helper/settings/secrets/actions"
echo ""
echo "Required secrets:"
echo "AWS_ACCESS_KEY_ID=[YOUR_ACCESS_KEY_ID]"
echo "AWS_SECRET_ACCESS_KEY=[YOUR_SECRET_ACCESS_KEY]"
echo "AWS_REGION=eu-west-3"
echo "ECS_CLUSTER=financial-helper-cluster"
echo "PROGRAMMER_TASK_DEFINITION=financial-helper-programmer-agent:5"
echo "PRODUCT_TASK_DEFINITION=financial-helper-product-agent:2"
echo "SUBNET_IDS=subnet-0480c0bbbb272c7f3,subnet-09e259a38907a945d"
echo "SECURITY_GROUP_IDS=sg-055ceedf4e4a2781d"
echo ""

echo "🎯 Steps to add secrets:"
echo "1. Go to your GitHub repository settings"
echo "2. Click 'Secrets and variables' → 'Actions'"
echo "3. Click 'New repository secret'"
echo "4. Add each secret above with the exact name and value"
echo ""

echo "✅ Benefits of this approach:"
echo "- No OIDC configuration complexity"
echo "- Direct AWS authentication"
echo "- Easier to debug and troubleshoot"
echo "- More reliable for getting started"
echo ""

echo "🚀 After adding secrets, test by:"
echo "1. Go to issue #2: https://github.com/thomasjamais/financial-helper/issues/2"
echo "2. Remove the 'ai' label"
echo "3. Add the 'ai' label back"
echo "4. Watch the Actions tab for execution"
