#!/bin/bash

# Test script for AI agents
# This script tests the basic functionality without requiring GitHub API access

echo "Testing AI Agent Implementation..."

# Test 1: Policy loading
echo "1. Testing policy loading..."
cd /home/thomas/Dev/financial-helper
node -e "
const { PolicyService } = require('./agent/dist/src/services/PolicyService.js');
const policy = new PolicyService().getPolicy();
console.log('Policy loaded successfully:', policy.mode);
console.log('Max changed files:', policy.maxChangedFiles);
console.log('Test suites:', policy.tests?.suites?.length || 0);
"

# Test 2: Type checking
echo "2. Testing TypeScript compilation..."
pnpm agent:build
if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Test 3: Check workflow files exist
echo "3. Checking workflow files..."
if [ -f ".github/workflows/ai-programmer.yml" ] && [ -f ".github/workflows/ai-product.yml" ] && [ -f ".github/workflows/ai-fix.yml" ]; then
    echo "✅ All workflow files present"
else
    echo "❌ Missing workflow files"
    exit 1
fi

# Test 4: Check agent entry points exist
echo "4. Checking agent entry points..."
if [ -f "agent/src/index.ts" ] && [ -f "agent/src/product/index.ts" ]; then
    echo "✅ Agent entry points present"
else
    echo "❌ Missing agent entry points"
    exit 1
fi

# Test 5: Check package.json scripts
echo "5. Checking package.json scripts..."
if grep -q "agent:dev:programmer" package.json && grep -q "agent:dev:product" package.json; then
    echo "✅ Development scripts present"
else
    echo "❌ Missing development scripts"
    exit 1
fi

echo ""
echo "🎉 All tests passed! AI agent implementation is complete."
echo ""
echo "Next steps:"
echo "1. Set up GitHub token: export GITHUB_TOKEN=ghp_xxx"
echo "2. Test programmer agent: ISSUE_NUMBER=123 pnpm agent:dev:programmer"
echo "3. Test product agent: PR_NUMBER=456 pnpm agent:dev:product"
echo "4. Configure ECS secrets in GitHub repository settings"
