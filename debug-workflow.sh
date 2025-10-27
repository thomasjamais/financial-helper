#!/bin/bash

# Debug script for GitHub workflow issues
echo "=== GitHub Workflow Debug Script ==="
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Not in a git repository"
    exit 1
fi

echo "✅ In a git repository"

# Check if we have GitHub CLI
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not installed"
    echo "   Install with: sudo apt install gh"
    exit 1
fi

echo "✅ GitHub CLI available"

# Check if we're authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub"
    echo "   Run: gh auth login"
    exit 1
fi

echo "✅ Authenticated with GitHub"

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "📁 Repository: $REPO"

# Check if plan label exists
echo ""
echo "🏷️  Checking labels..."
LABELS=$(gh api repos/$REPO/labels --jq '.[].name' | tr '\n' ' ')
echo "Available labels: $LABELS"

if echo "$LABELS" | grep -q "plan"; then
    echo "✅ 'plan' label exists"
else
    echo "❌ 'plan' label does NOT exist"
    echo ""
    echo "🔧 Creating 'plan' label..."
    gh api repos/$REPO/labels -X POST -f name=plan -f color=0e8a16 -f description="Issue requires planning before implementation"
    echo "✅ 'plan' label created"
fi

# Check workflow files
echo ""
echo "📋 Checking workflow files..."
if [ -f ".github/workflows/ai-plan.yml" ]; then
    echo "✅ ai-plan.yml exists"
else
    echo "❌ ai-plan.yml missing"
fi

if [ -f ".github/workflows/ai-programmer.yml" ]; then
    echo "✅ ai-programmer.yml exists"
else
    echo "❌ ai-programmer.yml missing"
fi

# Test workflow syntax
echo ""
echo "🔍 Testing workflow syntax..."
if python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ai-plan.yml'))" 2>/dev/null; then
    echo "✅ ai-plan.yml syntax is valid"
else
    echo "❌ ai-plan.yml syntax error"
fi

if python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ai-programmer.yml'))" 2>/dev/null; then
    echo "✅ ai-programmer.yml syntax is valid"
else
    echo "❌ ai-programmer.yml syntax error"
fi

echo ""
echo "🧪 Test Instructions:"
echo "1. Create a test issue with the 'plan' label:"
echo "   gh issue create --title 'Test Plan Issue' --body 'This is a test' --label 'plan'"
echo ""
echo "2. Check the Actions tab in GitHub to see if the workflow runs"
echo ""
echo "3. If it still doesn't work, check the workflow logs for the debug output"
echo ""

# Show recent issues
echo "📊 Recent issues:"
gh issue list --limit 5 --json number,title,labels --jq '.[] | "\(.number): \(.title) [\(.labels[].name // "no labels" | join(", "))]"'
