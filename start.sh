#!/bin/bash
echo "=== Starting Sofambl Backend ==="
echo "Time: $(date)"
echo "Node: $(node --version)"
echo "NPM: $(npm --version)"
echo "PORT: $PORT"
echo "NODE_ENV: $NODE_ENV"
echo "PWD: $(pwd)"
echo ""

# ساخت پوشه‌های مورد نیاز
mkdir -p uploads dist

# Build اگر dist/server.js وجود ندارد
if [ ! -f "dist/server.js" ]; then
  echo "Building application..."
  npm run build
fi

echo "File size of dist/server.js: $(wc -c < dist/server.js) bytes"
echo ""

# اجرای سرور
echo "=== Starting Node Server ==="
cd dist && exec node --trace-warnings server.js