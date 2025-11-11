#!/bin/bash
# Fix CloudFront cached error for /v1/strategies and /v1/strategies/examples

DISTRIBUTION_ID="E2K7GZFVBPV36E"

echo "Invalidating /v1/strategies* paths in CloudFront..."
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/v1/strategies" "/v1/strategies/*" "/v1/strategies/examples"

echo ""
echo "Waiting for invalidation to complete (this may take a few minutes)..."
echo "You can check status with:"
echo "aws cloudfront get-invalidation --distribution-id $DISTRIBUTION_ID --id <INVALIDATION_ID>"

