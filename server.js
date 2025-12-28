
  import express from 'express';
  import cors from 'cors';
  import multer from 'multer';
  import jwt from 'jsonwebtoken';
  import bcrypt from 'bcryptjs';
  import { initDatabase } from './init-db.js';
  import 'dotenv/config';
  import db from './db.js';
  import { adminAuth } from './auth.js';
  import path from 'path';
  import { fileURLToPath } from 'url';
  import { dirname } from 'path';


// === CRITICAL DEBUG ===
console.log('🚀🚀🚀 SERVER.JS IS EXECUTING! 🚀🚀🚀');
console.log('Timestamp:', new Date().toISOString());
console.log('Node version:', process.version);
console.log('Platform:', process.platform, process.arch);
console.log('Environment variables:');
console.log('  PORT:', process.env.PORT);
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  PWD:', process.cwd());

import fs from 'fs';
console.log('Directory contents:');
try {
  const files = fs.readdirSync('.');
  files.forEach(f => console.log('  -', f));
} catch (e) {
  console.error('Error reading dir:', e.message);
}

// Wrap everything in try-catch
try {
  console.log('=== IMPORTING MODULES ===');
  

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  console.log('✅ All modules imported successfully');
  
  // مقداردهی اولیه دیتابیس
  console.log('=== INITIALIZING DATABASE ===');
  initDatabase();
  console.log('✅ Database initialized');
  
  const app = express();

  let isReady = false;
setTimeout(() => {
  isReady = true;
  console.log('✅ Application is now ready for health checks');
}, 5000); // 5 ثانیه تاخیر

app.get('/health', (req, res) => {
  if (!isReady) {
    return res.status(503).json({ 
      status: 'starting', 
      message: 'Application is starting up' 
    });
  }
  
  try {
    // بررسی دیتابیس
    db.prepare('SELECT 1 as health_check').get();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Sofambl Furniture Backend API',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      public: ['/api/articles', '/api/categories', '/api/products', '/api/socials'],
      admin: ['/api/admin/login', '/api/admin/articles'],
      health: '/health'
    }
  });
});

  app.use(cors({
    origin: ['https://your-frontend-domain.com', 'http://localhost:3000'],
    credentials: true
  }));
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static('uploads'));
  
  // ایجاد پوشه uploads اگر وجود ندارد
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads', { recursive: true });
    console.log('✅ Created uploads directory');
  }
  
  // بقیه کدهای شما (همان کدهای routes)...
  // فقط مطمئن شوید که app.listen فقط یک بار فراخوانی شود
  
  // در انتهای فایل، بعد از همه routes:
  const PORT = process.env.PORT || 3000;
  const HOST = '0.0.0.0';
  
  console.log(`=== STARTING SERVER ON PORT ${PORT} ===`);
  
  const server = app.listen(PORT, HOST, () => {
    console.log(`🎉🎉🎉 SERVER STARTED SUCCESSFULLY! 🎉🎉🎉`);
    console.log(`📡 http://${HOST}:${PORT}`);
    console.log(`🕐 ${new Date().toISOString()}`);
    console.log('======================================');
  });
  
  server.on('error', (error) => {
    console.error('❌ SERVER ERROR:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    process.exit(1);
  });
  
} catch (error) {
  console.error('💥💥💥 FATAL ERROR DURING STARTUP 💥💥💥');
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
  console.error('Error occurred at:', new Date().toISOString());
  process.exit(1);
}