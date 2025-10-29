# Financial Helper

A comprehensive financial trading and portfolio management system built with TypeScript and deployed on AWS ECS Fargate.

## AI Agents

This repository includes automated AI agents for issue processing and PR review:

### Programmer Agent
- **Trigger**: Issues labeled with `ai` or new issues
- **Function**: Claims issues, creates branches, applies edits, runs tests, opens PRs
- **Modes**:
  - `new-issue`: Creates new branch and PR from issue
  - `fix-iteration`: Iterates on existing PR branch

### Product Agent  
- **Trigger**: PR opened or synchronized
- **Function**: Validates PR against policy, runs tests, posts reviews
- **Actions**: Approves passing PRs, requests changes for failures

### Fix Agent
- **Trigger**: `/ai:fix` comment on PR
- **Function**: Runs programmer agent in fix mode to iterate on PR

## Environment Variables

### Required
- `GITHUB_TOKEN`: GitHub personal access token
- `GH_OWNER`: Repository owner
- `GH_REPO`: Repository name

### Optional
- `POLICY_PATH`: Path to policy.yaml (default: `./policy.yaml`)
- `ASSIGNEE`: GitHub username for issue assignment (default: `ai-bot`)
- `DEFAULT_BRANCH`: Base branch for PRs (default: `main`)

### Mode-specific
- **New Issue Mode**: `ISSUE_NUMBER`
- **Fix Mode**: `PR_NUMBER`, `BRANCH`

## Local Development

### Setup
```bash
# Install dependencies
pnpm install

# Build agents
pnpm agent:build
```

### Testing Agents

#### Programmer Agent (New Issue)
```bash
ISSUE_NUMBER=123 pnpm agent:dev:programmer
```

#### Programmer Agent (Fix Mode)
```bash
PR_NUMBER=456 BRANCH=ai/456-sample pnpm agent:dev:programmer
```

#### Product Agent
```bash
PR_NUMBER=456 pnpm agent:dev:product
```

## Workflows

### `.github/workflows/ai-programmer.yml`
- Triggers on issues with `ai` label or new issues
- Runs programmer agent in new-issue mode

### `.github/workflows/ai-product.yml`  
- Triggers on PR opened/synchronized
- Runs product agent for PR review

### `.github/workflows/ai-fix.yml`
- Triggers on `/ai:fix` comment
- Runs programmer agent in fix mode

## Policy Configuration

Agents read configuration from `policy.yaml`:

- **Path restrictions**: Allowed/denied file paths
- **Pattern validation**: Forbidden patterns (secrets, keys)
- **Test suites**: Commands and timeouts
- **Coverage thresholds**: Minimum coverage requirements
- **Environment overrides**: Safe env vars for testing

## Architecture

- **Monorepo**: pnpm workspaces with TypeScript strict mode
- **Deployment**: AWS ECS Fargate with GitHub Actions OIDC
- **Policy-driven**: All actions constrained by root policy.yaml
- **Idempotent**: Concurrency controls prevent duplicate runs

## Exchange Adapters

Bitget adapter includes:

- Zod-validated config (paper by default; live gated by env)
- Per-endpoint rate limiting with jittered backoff
- Circuit breaker (CLOSED/OPEN/HALF_OPEN)
- Strict balance normalization (spot and futures)
- Env-based caps and symbol whitelist enforcement

### Environment Caps

- `SYMBOL_WHITELIST`: comma-separated symbols (e.g., `BTCUSDT,ETHUSDT,BNBUSDT`)
- `MAX_ORDER_USDT`: max order notional in USDT (0 disables)
- `MAX_POSITION_USDT`: max position notional in USDT (0 disables)

### Risk Management
## API

- `apps/api` exposes:
  - `GET /healthz`
  - `POST /v1/bitget/config` to set temporary Bitget credentials (paper/live)
  - `GET /v1/balances` for spot and futures
  - `GET /v1/positions`
  - `POST /v1/orders` with Zod validation and caps/risk enforcement

## Dashboard

- `apps/web` includes a minimal dashboard to:
  - Set Bitget config
  - View spot and futures balances
  - See API health

## Getting Started Locally

### Prerequisites

- Node.js 20+
- pnpm 9+

### Install dependencies (monorepo)

```bash
pnpm install
```

### Run API (terminal 1)

```bash
cd apps/api
pnpm dev
# API listens on http://localhost:8080
```

Optional: create a `.env` file in `apps/api`:

```bash
PORT=8080
LOG_LEVEL=info
```

### Run Web Dashboard (terminal 2)

```bash
cd apps/web
VITE_API_URL=http://localhost:8080 pnpm dev
# Dashboard on http://localhost:5173 (Vite default)
```

### Configure Bitget (paper) via API

```bash
curl -X POST \
  -H 'content-type: application/json' \
  -d '{
    "key": "YOUR_API_KEY",
    "secret": "YOUR_API_SECRET",
    "passphrase": "YOUR_PASSPHRASE",
    "env": "paper"
  }' \
  http://localhost:8080/v1/bitget/config
```

Then fetch balances:

```bash
curl http://localhost:8080/v1/balances
```

### Notes

- Live trading requires explicit configuration and is disabled by default.
- Env caps and risk management apply to order placement: `SYMBOL_WHITELIST`, `MAX_ORDER_USDT`, `MAX_POSITION_USDT`, `MAX_LEVERAGE`, `MAX_RISK_PER_TRADE`, `MAX_POSITION_SIZE`, `MIN_ORDER_SIZE`, `MAX_ORDER_SIZE`.


- `MAX_LEVERAGE`: maximum leverage allowed (default: 10)
- `MAX_RISK_PER_TRADE`: max risk per trade as percentage (default: 0.02 = 2%)
- `MAX_POSITION_SIZE`: max position size as percentage of balance (default: 0.1 = 10%)
- `MIN_ORDER_SIZE`: minimum order size (default: 0.001)
- `MAX_ORDER_SIZE`: maximum order size (default: 1000)
