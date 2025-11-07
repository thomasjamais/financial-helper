#!/usr/bin/env node

/**
 * Script pour corriger automatiquement les imports relatifs en ajoutant .js
 * pour la compatibilité ESM avec Node.js
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const API_SRC_DIR = path.join(__dirname, '../apps/api/src');

// Pattern pour trouver les imports relatifs sans extension
const RELATIVE_IMPORT_REGEX = /from\s+['"](\.\/[^'"]+)(?<!\.js)['"]/g;
const RELATIVE_IMPORT_REGEX_IMPORT = /import\s+.*?\s+from\s+['"](\.\/[^'"]+)(?<!\.js)['"]/g;
const RELATIVE_IMPORT_REGEX_DYNAMIC = /import\s*\(\s*['"](\.\/[^'"]+)(?<!\.js)['"]/g;

function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Remplacer les imports avec 'from'
  content = content.replace(RELATIVE_IMPORT_REGEX, (match, importPath) => {
    // Ignorer si c'est déjà .js, .json, ou un chemin de package
    if (importPath.endsWith('.js') || importPath.endsWith('.json') || importPath.startsWith('@')) {
      return match;
    }
    // Ignorer les imports de types
    if (match.includes('type ')) {
      return match;
    }
    modified = true;
    return match.replace(importPath, importPath + '.js');
  });

  // Remplacer les imports dynamiques
  content = content.replace(RELATIVE_IMPORT_REGEX_DYNAMIC, (match, importPath) => {
    if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
      return match;
    }
    modified = true;
    return match.replace(importPath, importPath + '.js');
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }
  return false;
}

async function main() {
  console.log('Fixing ESM imports in apps/api/src...\n');

  const files = await glob('**/*.ts', {
    cwd: API_SRC_DIR,
    absolute: true,
    ignore: ['**/*.spec.ts', '**/*.test.ts', '**/__tests__/**'],
  });

  let fixedCount = 0;
  for (const file of files) {
    if (fixImportsInFile(file)) {
      fixedCount++;
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} files`);
}

main().catch(console.error);

