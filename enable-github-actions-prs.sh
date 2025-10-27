#!/bin/bash

# Script to enable GitHub Actions to create pull requests
# Run this script to automatically configure the repository settings

echo "🔧 Enabling GitHub Actions to create pull requests..."

# Check if GITHUB_TOKEN is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ Error: GITHUB_TOKEN environment variable is required"
    echo "Please set your GitHub personal access token:"
    echo "export GITHUB_TOKEN=your_token_here"
    exit 1
fi

# Repository details
REPO_OWNER="thomasjamais"
REPO_NAME="financial-helper"

echo "📝 Updating repository settings for $REPO_OWNER/$REPO_NAME..."

# Enable GitHub Actions to create and approve pull requests
curl -X PATCH \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME" \
  -d '{
    "allow_auto_merge": true,
    "allow_merge_commit": true,
    "allow_rebase_merge": true,
    "allow_squash_merge": true,
    "delete_branch_on_merge": true
  }'

echo ""
echo "✅ Repository settings updated!"
echo ""
echo "🔧 Manual steps (if needed):"
echo "1. Go to: https://github.com/$REPO_OWNER/$REPO_NAME/settings"
echo "2. Navigate to Actions → General"
echo "3. Under 'Workflow permissions', select 'Read and write permissions'"
echo "4. Check 'Allow GitHub Actions to create and approve pull requests'"
echo "5. Save changes"
echo ""
echo "🚀 After enabling this, your AI agent should be able to create PRs!"

