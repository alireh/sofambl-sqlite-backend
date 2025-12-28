// working-server.js
const http = require('http');

console.log('=== WORKING SERVER ===');
console.log('Environment:');
console.log('- PORT:', process.env.PORT);
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PWD:', process.cwd());

const requestHandler = (req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);
  
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true,
      message: 'Server is working!',
      timestamp: new Date().toISOString(),
      port: process.env.PORT
    }));
    return;
  }
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: 'Welcome to Sofambl API',
    endpoints: {
      health: '/health',
      root: '/'
    }
  }));
};

const PORT = process.env.PORT || 3000;
const server = http.createServer(requestHandler);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is listening on 0.0.0.0:${PORT}`);
  console.log(`🌍 External URL: https://sofambl-sqlite-backend-production.up.railway.app`);
});

server.on('error', (error) => {
  console.error('❌ Server failed to start:', error.message);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});