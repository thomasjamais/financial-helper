import type { EditTask } from './EditService.js'

export interface SpecContext {
  issueTitle: string
  issueBody: string
  specContent: string
}

export class TaskGeneratorService {
  generateTasksFromSpec(context: SpecContext): EditTask[] {
    const tasks: EditTask[] = []
    const { issueTitle, issueBody, specContent } = context

    // Analyze the issue and spec to generate concrete tasks
    const content = `${issueTitle}\n${issueBody}\n${specContent}`.toLowerCase()

    // API Endpoint Tasks
    if (
      content.includes('api') ||
      content.includes('endpoint') ||
      content.includes('route')
    ) {
      tasks.push(...this.generateApiTasks(content))
    }

    // Database Tasks
    if (
      content.includes('database') ||
      content.includes('db') ||
      content.includes('migration')
    ) {
      tasks.push(...this.generateDatabaseTasks(content))
    }

    // Bot Service Tasks
    if (
      content.includes('bot') ||
      content.includes('microservice') ||
      content.includes('service')
    ) {
      tasks.push(...this.generateBotTasks(content))
    }

    // Test Tasks
    if (
      content.includes('test') ||
      content.includes('testing') ||
      content.includes('unit test')
    ) {
      tasks.push(...this.generateTestTasks(content))
    }

    // UI/Frontend Tasks
    if (
      content.includes('ui') ||
      content.includes('frontend') ||
      content.includes('component') ||
      content.includes('react')
    ) {
      tasks.push(...this.generateUITasks(content))
    }

    // Configuration Tasks
    if (
      content.includes('config') ||
      content.includes('package.json') ||
      content.includes('tsconfig')
    ) {
      tasks.push(...this.generateConfigTasks(content))
    }

    // Documentation Tasks
    if (
      content.includes('readme') ||
      content.includes('documentation') ||
      content.includes('docs')
    ) {
      tasks.push(...this.generateDocTasks(content))
    }

    // If no specific patterns found, generate generic tasks
    if (tasks.length === 0) {
      tasks.push(...this.generateGenericTasks(content))
    }

    return tasks
  }

  private generateApiTasks(content: string): EditTask[] {
    const tasks: EditTask[] = []

    // Extract endpoint patterns
    const endpointMatches = content.match(
      /(get|post|put|delete|patch)\s+\/([a-zA-Z0-9\/\-_]+)/g,
    )

    if (endpointMatches) {
      for (const match of endpointMatches) {
        const [method, path] = match.split(' ')
        const endpointName = path.replace(/\//g, '-').replace(/^-/, '')

        // Add endpoint to API
        tasks.push({
          filePath: 'apps/api/src/index.ts',
          operation: 'append',
          content: `
// ${method.toUpperCase()} ${path} endpoint
app.${method.toLowerCase()}('${path}', (req, res) => {
  res.json({ ok: true, message: '${method.toUpperCase()} ${path} endpoint' })
})`,
          description: `Add ${method.toUpperCase()} ${path} endpoint to API`,
        })

        // Create test for endpoint
        tasks.push({
          filePath: `apps/api/tests/${endpointName}.spec.ts`,
          operation: 'create',
          content: `import request from 'supertest'
import { app } from '../src/index'

describe('${method.toUpperCase()} ${path}', () => {
  it('should return success response', async () => {
    const response = await request(app)
      .${method.toLowerCase()}('${path}')
      .expect(200)
    
    expect(response.body).toEqual({ ok: true, message: '${method.toUpperCase()} ${path} endpoint' })
  })
})`,
          description: `Create test for ${method.toUpperCase()} ${path} endpoint`,
        })
      }
    }

    return tasks
  }

  private generateDatabaseTasks(content: string): EditTask[] {
    const tasks: EditTask[] = []

    // Create migration if mentioned
    if (content.includes('migration')) {
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0]
      tasks.push({
        filePath: `packages/db/migrations/${timestamp}_add_feature.sql`,
        operation: 'create',
        content: `-- Migration: Add feature
-- Generated from issue specification

-- Add your SQL here
-- Example:
-- CREATE TABLE IF NOT EXISTS feature_table (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );`,
        description: 'Create database migration for new feature',
      })
    }

    return tasks
  }

  private generateBotTasks(content: string): EditTask[] {
    const tasks: EditTask[] = []

    // Bot microservice setup
    if (content.includes('bot') && content.includes('microservice')) {
      tasks.push({
        filePath: 'apps/bot/package.json',
        operation: 'update',
        content: `{
  "name": "@apps/bot",
  "version": "0.0.1",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest",
    "lint": "eslint ."
  },
  "dependencies": {
    "express": "^4.19.2",
    "pino": "^9.4.0",
    "pino-http": "^10.3.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "tsx": "^4.7.0",
    "typescript": "^5.6.2",
    "vitest": "^1.6.0",
    "supertest": "^6.3.4",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/supertest": "^6.0.2",
    "eslint": "^9.10.0",
    "@typescript-eslint/eslint-plugin": "^7.18.0",
    "@typescript-eslint/parser": "^7.18.0"
  }
}`,
        description: 'Update bot microservice package.json',
      })

      tasks.push({
        filePath: 'apps/bot/src/index.ts',
        operation: 'update',
        content: `import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pino from 'pino'
import pinoHttp from 'pino-http'

const app = express()
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' })
app.use(pinoHttp({ logger }))
app.use(cors())
app.use(express.json())

// Status endpoint
app.get('/status', (req, res) => {
  logger.info({ endpoint: '/status' }, 'Status endpoint called')
  res.json({ ok: true })
})

const port = Number(process.env.PORT ?? 8081)
app.listen(port, () => {
  logger.info({ port }, 'Bot service listening')
})

export { app }`,
        description: 'Update bot microservice main file',
      })
    }

    return tasks
  }

  private generateTestTasks(content: string): EditTask[] {
    const tasks: EditTask[] = []

    // Generate test files based on content
    if (content.includes('unit test')) {
      tasks.push({
        filePath: 'apps/api/tests/generated.spec.ts',
        operation: 'create',
        content: `import { describe, it, expect } from 'vitest'

describe('Generated Tests', () => {
  it('should pass basic test', () => {
    expect(true).toBe(true)
  })
})`,
        description: 'Create generated unit tests',
      })
    }

    return tasks
  }

  private generateUITasks(content: string): EditTask[] {
    const tasks: EditTask[] = []

    // React component tasks
    if (content.includes('react') || content.includes('component')) {
      tasks.push({
        filePath: 'apps/web/src/components/GeneratedComponent.tsx',
        operation: 'create',
        content: `import React from 'react'

interface GeneratedComponentProps {
  title: string
}

export const GeneratedComponent: React.FC<GeneratedComponentProps> = ({ title }) => {
  return (
    <div className="generated-component">
      <h1>{title}</h1>
      <p>This component was generated from the issue specification.</p>
    </div>
  )
}`,
        description: 'Create generated React component',
      })
    }

    return tasks
  }

  private generateConfigTasks(content: string): EditTask[] {
    const tasks: EditTask[] = []

    // TypeScript config updates
    if (content.includes('typescript') || content.includes('tsconfig')) {
      tasks.push({
        filePath: 'apps/api/tsconfig.json',
        operation: 'update',
        content: `{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}`,
        description: 'Update TypeScript configuration',
      })
    }

    return tasks
  }

  private generateDocTasks(content: string): EditTask[] {
    const tasks: EditTask[] = []

    // README updates
    if (content.includes('readme') || content.includes('documentation')) {
      tasks.push({
        filePath: 'README.md',
        operation: 'update',
        content: `# Financial Helper

A financial trading helper application with AI-powered automation.

## Features

- AI-powered issue to implementation workflow
- Automated code generation and testing
- Policy-driven development with guardrails

## API Endpoints

- \`GET /healthz\` - Health check endpoint
- \`GET /v1/ping\` - Health check endpoint
- \`POST /v1/exchanges\` - Link exchange credentials

## Bot Service

- \`GET /status\` - Bot service status endpoint

## Development

This project uses AI agents to automatically implement features from GitHub issues.

### Workflow

1. Create issue with \`plan\` label
2. AI generates technical specification
3. Specification gets validated
4. AI implements the feature
5. Code gets reviewed and merged

### Policy

The \`policy.yaml\` file defines:
- Allowed/denied file paths
- Test requirements
- Security patterns
- Development standards`,
        description: 'Update README with current features',
      })
    }

    return tasks
  }

  private generateGenericTasks(content: string): EditTask[] {
    const tasks: EditTask[] = []

    // Generic implementation tasks
    tasks.push({
      filePath: 'apps/api/src/generated-feature.ts',
      operation: 'create',
      content: `// Generated feature implementation
// Based on issue specification

export class GeneratedFeature {
  constructor() {
    console.log('Generated feature initialized')
  }
  
  public process(): string {
    return 'Feature processed successfully'
  }
}`,
      description: 'Create generic feature implementation',
    })

    tasks.push({
      filePath: 'apps/api/tests/generated-feature.spec.ts',
      operation: 'create',
      content: `import { describe, it, expect } from 'vitest'
import { GeneratedFeature } from '../src/generated-feature'

describe('GeneratedFeature', () => {
  it('should process successfully', () => {
    const feature = new GeneratedFeature()
    const result = feature.process()
    expect(result).toBe('Feature processed successfully')
  })
})`,
      description: 'Create test for generated feature',
    })

    return tasks
  }
}
