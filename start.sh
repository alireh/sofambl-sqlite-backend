#!/bin/bash
echo "=== Starting Application ==="
echo "PORT: $PORT"
echo "NODE_ENV: $NODE_ENV"
echo "Current directory: $(pwd)"
echo "Files:"
ls -la

# Wait a bit before starting
sleep 2

# Start the server
node dist/server.js