#!/bin/bash

# Script pour exporter les logs CloudWatch vers un fichier
# Usage: ./scripts/export-logs.sh <log-group-name> [hours] [region] [output-file]

LOG_GROUP=$1
HOURS=${2:-1}
REGION=${3:-eu-west-3}
OUTPUT_FILE=${4:-}

if [ -z "$LOG_GROUP" ]; then
  echo "Usage: $0 <log-group-name> [hours] [region] [output-file]"
  echo ""
  echo "Examples:"
  echo "  $0 /ecs/financial-helper-api 1"
  echo "  $0 /ecs/financial-helper-api 24 eu-west-3 api-logs.txt"
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

# Générer le nom de fichier si non fourni
if [ -z "$OUTPUT_FILE" ]; then
  LOG_NAME=$(basename "$LOG_GROUP" | tr '/' '-')
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  OUTPUT_FILE="${LOG_NAME}-${TIMESTAMP}.log"
fi

SINCE="${HOURS}h"

echo "Exporting logs from $LOG_GROUP (last $HOURS hours, region: $REGION)..."
echo "Output file: $OUTPUT_FILE"
echo ""

aws logs tail "$LOG_GROUP" \
  --since "$SINCE" \
  --format short \
  --region "$REGION" > "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
  LINES=$(wc -l < "$OUTPUT_FILE")
  SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
  echo ""
  echo "✅ Export completed successfully!"
  echo "   File: $OUTPUT_FILE"
  echo "   Lines: $LINES"
  echo "   Size: $SIZE"
else
  echo ""
  echo "❌ Export failed!"
  exit 1
fi

