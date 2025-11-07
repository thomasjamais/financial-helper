#!/bin/bash

# Script pour suivre les logs CloudWatch en temps réel
# Usage: ./scripts/tail-logs.sh <log-group-name> [region] [filter-pattern]

LOG_GROUP=$1
REGION=${2:-eu-west-3}
FILTER_PATTERN=${3:-}

if [ -z "$LOG_GROUP" ]; then
  echo "Usage: $0 <log-group-name> [region] [filter-pattern]"
  echo ""
  echo "Examples:"
  echo "  $0 /ecs/financial-helper-api"
  echo "  $0 /ecs/financial-helper-bot"
  echo "  $0 /ecs/financial-helper-api eu-west-3 'ERROR'"
  echo ""
  echo "Available log groups:"
  echo "  - /ecs/financial-helper-api"
  echo "  - /ecs/financial-helper-bot"
  exit 1
fi

# Vérifier que AWS CLI est installé
if ! command -v aws &> /dev/null; then
  echo "Error: AWS CLI is not installed. Please install it first."
  echo "Visit: https://aws.amazon.com/cli/"
  exit 1
fi

# Construire la commande
CMD="aws logs tail \"$LOG_GROUP\" --follow --format short --region \"$REGION\""

if [ -n "$FILTER_PATTERN" ]; then
  CMD="$CMD --filter-pattern \"$FILTER_PATTERN\""
fi

echo "Following logs from $LOG_GROUP (region: $REGION)"
if [ -n "$FILTER_PATTERN" ]; then
  echo "Filter pattern: $FILTER_PATTERN"
fi
echo "Press Ctrl+C to stop"
echo ""

eval $CMD

