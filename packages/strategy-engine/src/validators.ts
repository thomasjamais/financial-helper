const DANGEROUS_PATTERNS = [
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\brequire\s*\(/,
  /\bimport\s+/,
  /\bfrom\s+['"]/,
  /\bprocess\./,
  /\bfs\./,
  /\bfileSystem\./,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest/,
  /\bWebSocket/,
  /\bchild_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /\b__dirname/,
  /\b__filename/,
  /\bmodule\./,
  /\bexports\./,
  /\bglobal\./,
  /\bwindow\./,
  /\bdocument\./,
  /\blocalStorage/,
  /\bsessionStorage/,
  /\bBuffer\./,
  /\bBuffer\s*\(/,
]

export function validateStrategyCode(code: string): { valid: boolean; error?: string } {
  if (!code || code.trim().length === 0) {
    return { valid: false, error: 'Strategy code cannot be empty' }
  }

  if (code.length > 50000) {
    return { valid: false, error: 'Strategy code exceeds maximum length (50000 characters)' }
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      return {
        valid: false,
        error: `Code contains forbidden pattern: ${pattern.source}`,
      }
    }
  }

  if (!code.includes('class') && !code.includes('interface')) {
    return { valid: false, error: 'Strategy must define a class or interface' }
  }

  if (!code.includes('onCandle')) {
    return { valid: false, error: 'Strategy must implement onCandle method' }
  }

  return { valid: true }
}

export function sanitizeStrategyCode(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .trim()
}

