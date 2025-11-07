#!/usr/bin/env node

/**
 * Script pour ajouter les extensions .js aux imports relatifs dans les fichiers compilés
 * Cela permet de garder les imports sans extensions dans les fichiers .ts
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern pour trouver les imports relatifs sans extension
  // from './something' ou from "../something" mais pas from './something.js' ou from '@pkg/...'
  const relativeImportRegex = /from\s+['"](\.\/[^'"]+?)(?<!\.js)(?<!\.json)['"]/g;
  const sideEffectImportRegex = /^import\s+['"](\.\/[^'"]+?)(?<!\.js)(?<!\.json)['"];?$/gm;
  const dynamicImportRegex = /import\s*\(\s*['"](\.\/[^'"]+?)(?<!\.js)(?<!\.json)['"]/g;

  // Remplacer les imports avec 'from'
  content = content.replace(relativeImportRegex, (match, importPath) => {
    // Ignorer si c'est déjà .js, .json, ou un chemin de package
    if (importPath.endsWith('.js') || importPath.endsWith('.json') || importPath.startsWith('@')) {
      return match;
    }
    modified = true;
    return match.replace(importPath, importPath + '.js');
  });

  // Remplacer les imports side-effect (import './something')
  content = content.replace(sideEffectImportRegex, (match, importPath) => {
    if (importPath.endsWith('.js') || importPath.endsWith('.json') || importPath.startsWith('@')) {
      return match;
    }
    modified = true;
    return match.replace(importPath, importPath + '.js');
  });

  // Remplacer les imports dynamiques
  content = content.replace(dynamicImportRegex, (match, importPath) => {
    if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
      return match;
    }
    modified = true;
    return match.replace(importPath, importPath + '.js');
  });

  if (modified) {
    writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function processDirectory(dirPath) {
  let count = 0;
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      count += processDirectory(fullPath);
    } else if (entry.endsWith('.js')) {
      if (processFile(fullPath)) {
        count++;
      }
    }
  }

  return count;
}

function main() {
  const distPath = process.argv[2] || join(__dirname, '../apps/api/dist');

  if (!statSync(distPath).isDirectory()) {
    console.error(`Error: ${distPath} is not a directory`);
    process.exit(1);
  }

  console.log(`Processing ${distPath}...`);
  const count = processDirectory(distPath);
  console.log(`✅ Added .js extensions to ${count} files`);
}

main();

