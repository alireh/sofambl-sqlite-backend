const http = require('http');

console.log('=== SIMPLE SERVER START ===');
console.log('PORT from env:', process.env.PORT);
console.log('All env vars:', Object.keys(process.env).filter(k => k.includes('PORT')));

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} from ${req.headers['user-agent']}`);
  
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'simple-test',
      port: process.env.PORT,
      time: new Date().toISOString()
    }));
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🎉 SERVER LISTENING ON ${HOST}:${PORT}`);
  console.log(`🚀 Ready for connections!`);
});

server.on('error', (err) => {
  console.error('❌ SERVER ERROR:', err.message, err.code);
  process.exit(1);
});