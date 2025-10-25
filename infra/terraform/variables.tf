variable "project" { type = string }
variable "region" {
  type    = string
  default = "eu-west-3"
}
variable "vpc_cidr" {
  type    = string
  default = "10.60.0.0/16"
}
variable "public_subnets" {
  type    = list(string)
  default = ["10.60.1.0/24", "10.60.2.0/24"]
}

# ECS sizing
variable "fargate_cpu" {
  type    = number
  default = 512
} # 0.5 vCPU
variable "fargate_mem" {
  type    = number
  default = 1024
} # 1 GB

# Container image tag to deploy (must exist in ECR)
variable "agent_image_tag" {
  type    = string
  default = "latest"
}

# GitHub repo settings (agent will work on this repo)
variable "github_repo_slug" { type = string } # e.g. "youruser/crypto-trade-dashboard"
variable "github_issue_labels" {
  type    = string
  default = "Ready,Help-Wanted"
}

variable "enable_keepalive" {
  type    = bool
  default = false
}

# Initial placeholders for secrets (you can set/rotate later in console)
variable "github_app_id" { type = string }
variable "github_private_key_pem" { type = string } # content of private key PEM
variable "openai_api_key" {
  type    = string
  default = ""
}
variable "anthropic_api_key" {
  type    = string
  default = ""
}

# Policy for the agent (YAML)
variable "agent_policy_yaml" {
  type    = string
  default = <<-YAML
agent:
  mode: moderate
  max_lines_changed: 600
  require_tests: true
allow:
  paths: ["apps/**","packages/**","infra/**",".github/**"]
  languages: ["ts","tsx","json","yml","yaml","sql","md"]
deny:
  paths: ["**/*.pem","**/.env","**/secrets/**"]
tests:
  suites:
    - name: typecheck
      cmd: "pnpm -w tsc -b"
    - name: lint
      cmd: "pnpm -w lint"
    - name: unit
      cmd: "pnpm -w test -- --run"
guards:
  forbid_live_trading: true
  env_overrides:
    LIVE_TRADING_ENABLED: "false"
    BITGET_ENV: "paper"
YAML
}
