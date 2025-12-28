#!/bin/bash
echo "=== Starting Application ==="
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "PORT: $PORT"
echo "NODE_ENV: $NODE_ENV"
echo "Current directory: $(pwd)"
echo ""
echo "Files in directory:"
ls -la
echo ""
echo "Files in dist directory:"
ls -la dist/ 2>/dev/null || echo "dist directory not found"
echo ""
echo "=== Starting Server ==="

# اجرای سرور با دیباگ
node --trace-warnings dist/server.js