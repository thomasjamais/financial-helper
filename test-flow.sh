#!/bin/bash

# Test script for complete AI agent flow
set -e

echo "🧪 Testing AI Agent Flow..."

# Test 1: Create a test issue
echo "1. Creating test issue..."
ISSUE_TITLE="Test AI Agent: Add new feature"
ISSUE_BODY="This is a test issue to verify the AI agent automation works correctly.

## Requirements
- Add a new API endpoint
- Update documentation
- Add tests

## Acceptance Criteria
- [ ] API endpoint works
- [ ] Tests pass
- [ ] Documentation updated"

# You can create this issue manually in GitHub or use gh CLI:
# gh issue create --title "$ISSUE_TITLE" --body "$ISSUE_BODY" --label "ai"

echo "✅ Test issue created. Please:"
echo "   1. Go to GitHub and create an issue with title: '$ISSUE_TITLE'"
echo "   2. Add the 'ai' label to the issue"
echo "   3. Watch the automation trigger!"

# Test 2: Verify workflows are active
echo ""
echo "2. Checking GitHub Actions workflows..."
if [ -f ".github/workflows/ai-programmer.yml" ]; then
    echo "✅ ai-programmer.yml exists"
else
    echo "❌ ai-programmer.yml missing"
fi

if [ -f ".github/workflows/ai-product.yml" ]; then
    echo "✅ ai-product.yml exists"
else
    echo "❌ ai-product.yml missing"
fi

if [ -f ".github/workflows/ai-fix.yml" ]; then
    echo "✅ ai-fix.yml exists"
else
    echo "❌ ai-fix.yml missing"
fi

# Test 3: Check policy configuration
echo ""
echo "3. Checking policy configuration..."
if [ -f "policy.yaml" ]; then
    echo "✅ policy.yaml exists"
    echo "   Mode: $(grep 'mode:' policy.yaml | head -1 | cut -d: -f2 | tr -d ' ')"
    echo "   Max files: $(grep 'maxChangedFiles:' policy.yaml | cut -d: -f2 | tr -d ' ')"
else
    echo "❌ policy.yaml missing"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Create the test issue in GitHub with 'ai' label"
echo "2. Watch the Actions tab for workflow execution"
echo "3. Check the created PR for automated review"
echo "4. Test fix iteration by commenting '/ai:fix' on the PR"
echo ""
echo "📋 Required GitHub Secrets:"
echo "   - AWS_ROLE_ARN"
echo "   - AWS_REGION" 
echo "   - ECS_CLUSTER"
echo "   - PROGRAMMER_TASK_DEFINITION"
echo "   - PRODUCT_TASK_DEFINITION"
echo "   - SUBNET_IDS"
echo "   - SECURITY_GROUP_IDS"
