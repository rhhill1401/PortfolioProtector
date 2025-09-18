#!/bin/bash

echo "=== Testing ETF Flows for IBIT ==="
curl -s -X POST "https://twnldqhqbybnmqbsgvpq.supabase.co/functions/v1/etf-flows" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bmxkcWhxYnlibm1xYnNndnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzkyMzcsImV4cCI6MjA2MzU1NTIzN30.aXg505jKcHu8LL0_kBcDZHJl92NjyYMcUCbLLrQd3RQ" \
  -d '{"ticker": "IBIT"}' | python3 -m json.tool

echo -e "\n\n=== Testing ETF Flows for ETHA ==="
curl -s -X POST "https://twnldqhqbybnmqbsgvpq.supabase.co/functions/v1/etf-flows" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bmxkcWhxYnlibm1xYnNndnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzkyMzcsImV4cCI6MjA2MzU1NTIzN30.aXg505jKcHu8LL0_kBcDZHJl92NjyYMcUCbLLrQd3RQ" \
  -d '{"ticker": "ETHA"}' | python3 -m json.tool

echo -e "\n\n=== Testing Market Context for IBIT ==="
curl -s -X POST "https://twnldqhqbybnmqbsgvpq.supabase.co/functions/v1/market-context" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bmxkcWhxYnlibm1xYnNndnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzkyMzcsImV4cCI6MjA2MzU1NTIzN30.aXg505jKcHu8LL0_kBcDZHJl92NjyYMcUCbLLrQd3RQ" \
  -d '{"ticker": "IBIT"}' | python3 -m json.tool | head -50

echo -e "\n\n=== Testing Market Context for ETHA ==="
curl -s -X POST "https://twnldqhqbybnmqbsgvpq.supabase.co/functions/v1/market-context" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bmxkcWhxYnlibm1xYnNndnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzkyMzcsImV4cCI6MjA2MzU1NTIzN30.aXg505jKcHu8LL0_kBcDZHJl92NjyYMcUCbLLrQd3RQ" \
  -d '{"ticker": "ETHA"}' | python3 -m json.tool | head -50