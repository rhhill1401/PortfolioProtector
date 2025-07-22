#!/bin/bash

# Test Polygon Options API with curl
API_KEY="UgMrYPQ2pvp8ClkTvuEsWZ7jLj7B_ixu"
TICKER="AAPL"

echo "Testing Polygon Options API..."
echo "URL: https://api.polygon.io/v3/snapshot/options/${TICKER}?apiKey=${API_KEY}&limit=5&contract_type=call"
echo ""

curl -X GET "https://api.polygon.io/v3/snapshot/options/${TICKER}?apiKey=${API_KEY}&limit=5&contract_type=call" \
  -H "Accept: application/json" \
  | python3 -m json.tool

echo ""
echo "For Postman:"
echo "1. Method: GET"
echo "2. URL: https://api.polygon.io/v3/snapshot/options/AAPL"
echo "3. Query Params:"
echo "   - apiKey: ${API_KEY}"
echo "   - limit: 5"
echo "   - contract_type: call"
echo "4. Headers:"
echo "   - Accept: application/json"