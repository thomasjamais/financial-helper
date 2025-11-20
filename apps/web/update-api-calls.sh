#!/bin/bash
# Script to update axios calls to use apiClient

# Find all TypeScript/TSX files that import axios or use API_BASE
FILES=$(find apps/web/src -name "*.ts" -o -name "*.tsx" | grep -v "api.ts" | xargs grep -l "from ['\"]axios['\"]\|API_BASE\|fetch.*VITE_API" 2>/dev/null)

for file in $FILES; do
  echo "Processing $file..."
  
  # Skip if already using apiClient
  if grep -q "apiClient" "$file"; then
    echo "  Already using apiClient, skipping..."
    continue
  fi
  
  # Add import if not present
  if ! grep -q "import.*apiClient" "$file"; then
    # Find the line with axios import or API_BASE
    if grep -q "import.*axios" "$file"; then
      # Replace axios import
      sed -i "s/import axios from 'axios'/import { apiClient } from '..\/lib\/api'/g" "$file"
      sed -i "s/import axios from \"axios\"/import { apiClient } from \"..\/lib\/api\"/g" "$file"
    else
      # Add import after other imports
      sed -i "/^import/a import { apiClient } from '../lib/api'" "$file"
    fi
  fi
  
  # Remove API_BASE constant
  sed -i "/^const API_BASE/d" "$file"
  
  # Replace axios.get calls
  sed -i "s/axios\.get(\`\${API_BASE}\/\([^`]*\)\`/apiClient.get('\/\1'/g" "$file"
  sed -i "s/axios\.get(\`\${API_BASE}\/\([^`]*\)\`/apiClient.get('\/\1'/g" "$file"
  
  # Replace axios.post calls
  sed -i "s/axios\.post(\`\${API_BASE}\/\([^`]*\)\`/apiClient.post('\/\1'/g" "$file"
  
  # Replace axios.put calls
  sed -i "s/axios\.put(\`\${API_BASE}\/\([^`]*\)\`/apiClient.put('\/\1'/g" "$file"
  
  # Replace axios.delete calls
  sed -i "s/axios\.delete(\`\${API_BASE}\/\([^`]*\)\`/apiClient.delete('\/\1'/g" "$file"
  
  # Remove headers with Authorization (now handled by interceptor)
  # This is more complex and might need manual review
  
done

echo "Done! Please review the changes and test."

