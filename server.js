
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

app.use(cors({
  origin: ['https://your-frontend-domain.com', 'http://localhost:3000'],
  credentials: true
}));

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