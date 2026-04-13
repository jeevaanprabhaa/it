#!/usr/bin/env bash
set -e

echo "Starting StockSharp Web Terminal..."
echo ""

# Start the backend API server
cd server
node index.js &
SERVER_PID=$!
echo "Backend server started (PID: $SERVER_PID)"

# Wait for server to initialize
sleep 2

# Start the frontend dev server
cd ../client
npm run dev
