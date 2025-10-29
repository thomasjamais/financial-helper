#!/bin/bash
set -e

echo "Starting database services..."
cd "$(dirname "$0")/../infra"
docker compose up -d postgres

echo "Waiting for PostgreSQL to be ready..."
sleep 3

# Check if postgres is ready
until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-financial}" > /dev/null 2>&1; do
  echo "Waiting for PostgreSQL..."
  sleep 1
done

echo "✅ Database is ready!"
echo ""
echo "Your database connection string:"
echo "postgres://${POSTGRES_USER:-financial}:${POSTGRES_PASSWORD:-financial}@localhost:5432/${POSTGRES_DB:-financial-helper}"
echo ""
echo "To stop: docker compose -f infra/compose.yaml down"
echo "To view logs: docker compose -f infra/compose.yaml logs -f postgres"

