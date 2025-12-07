#!/bin/bash
# Test Script for POST /api/reviews (curl version)
# 
# Usage: ./test-review-api.sh
# 
# Make sure the API server is running on http://localhost:3001

API_URL="http://localhost:3001/api/reviews"
TIMESTAMP=$(date +%s)
RANDOM_ID=$(openssl rand -hex 8)

echo "🧪 Testing POST /api/reviews endpoint..."
echo ""

# Test payload
PAYLOAD=$(cat <<EOF
{
  "placeId": "test-place-${TIMESTAMP}",
  "placeName": "Test Coffee Shop",
  "lat": 41.0422,
  "lng": 29.0081,
  "rating": 4.5,
  "comment": "This is a test review from curl",
  "walletAddress": "0x1234567890123456789012345678901234567890",
  "transactionDigest": "test-tx-${TIMESTAMP}-${RANDOM_ID}"
}
EOF
)

echo "📤 Request payload:"
echo "$PAYLOAD" | jq '.' 2>/dev/null || echo "$PAYLOAD"
echo ""

# Make the request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

# Split response and status code
HTTP_BODY=$(echo "$RESPONSE" | head -n -1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

echo "📥 Response status: $HTTP_CODE"
echo "📥 Response body:"
echo "$HTTP_BODY" | jq '.' 2>/dev/null || echo "$HTTP_BODY"
echo ""

if [ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ Test PASSED - Review created successfully!"
  WALRUS_ID=$(echo "$HTTP_BODY" | jq -r '.walrusId' 2>/dev/null)
  REVIEW_ID=$(echo "$HTTP_BODY" | jq -r '.review.id' 2>/dev/null)
  if [ "$WALRUS_ID" != "null" ] && [ -n "$WALRUS_ID" ]; then
    echo "   Walrus ID: $WALRUS_ID"
  fi
  if [ "$REVIEW_ID" != "null" ] && [ -n "$REVIEW_ID" ]; then
    echo "   Review ID: $REVIEW_ID"
  fi
else
  echo "❌ Test FAILED - Server returned error"
  ERROR_TYPE=$(echo "$HTTP_BODY" | jq -r '.error' 2>/dev/null)
  ERROR_MSG=$(echo "$HTTP_BODY" | jq -r '.message' 2>/dev/null)
  if [ "$ERROR_TYPE" != "null" ] && [ -n "$ERROR_TYPE" ]; then
    echo "   Error type: $ERROR_TYPE"
  fi
  if [ "$ERROR_MSG" != "null" ] && [ -n "$ERROR_MSG" ]; then
    echo "   Error message: $ERROR_MSG"
  fi
fi

