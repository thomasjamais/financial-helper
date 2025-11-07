#!/bin/bash

# Script pour rechercher des patterns dans les logs CloudWatch
# Usage: ./scripts/search-logs.sh <log-group-name> <pattern> [hours] [region]

LOG_GROUP=$1
PATTERN=$2
HOURS=${3:-1}
REGION=${4:-eu-west-3}

if [ -z "$LOG_GROUP" ] || [ -z "$PATTERN" ]; then
  echo "Usage: $0 <log-group-name> <pattern> [hours] [region]"
  echo ""
  echo "Examples:"
  echo "  $0 /ecs/financial-helper-api 'trade-ideas' 2"
  echo "  $0 /ecs/financial-helper-api 'ERROR' 1"
  echo "  $0 /ecs/financial-helper-bot 'tick' 4"
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

SINCE="${HOURS}h"

echo "Searching for '$PATTERN' in $LOG_GROUP (last $HOURS hours, region: $REGION)..."
echo ""

aws logs tail "$LOG_GROUP" \
  --since "$SINCE" \
  --format short \
  --region "$REGION" \
  --filter-pattern "$PATTERN"

