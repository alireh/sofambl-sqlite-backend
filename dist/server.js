import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initDatabase } from './init-db.js';
import 'dotenv/config';

import db from './db.js';
import { adminAuth } from './auth.js';

// اضافه کردن این خطا برای دیباگ
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// شروع try-catch اصلی
try {
  console.log('=== STARTING SERVER ===');
  console.log('Current directory:', process.cwd());
  console.log('__dirname:', __dirname);
  
  const app = express();
  
  // بقیه کدهای شما...
  
  // در انتهای فایل، قبل از app.listen:
  console.log('=== INITIALIZING DATABASE ===');
  try {
    initDatabase();
    console.log('✅ Database initialized');
  } catch (dbError) {
    console.error('❌ Database init error:', dbError.message);
    // اگر دیتابیس مشکل داشت، ادامه نده
    process.exit(1);
  }
  
  // Health check ساده‌تر
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok',
      time: new Date().toISOString()
    });
  });
  
  // Route تست
  app.get('/test', (req, res) => {
    res.json({ message: 'Server is working' });
  });
  
  // اصلاح شده app.listen
  const PORT = process.env.PORT || 5000;
  const HOST = '0.0.0.0';
  
  console.log('=== STARTING SERVER LISTEN ===');
  console.log(`Port: ${PORT}`);
  console.log(`Host: ${HOST}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  
  const server = app.listen(PORT, HOST, () => {
    console.log(`✅ SERVER STARTED SUCCESSFULLY`);
    console.log(`📡 Listening on http://${HOST}:${PORT}`);
    console.log(`🕐 ${new Date().toISOString()}`);
  });
  
  // Handle server errors
  server.on('error', (error) => {
    console.error('❌ SERVER ERROR:', error.message);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
    }
    process.exit(1);
  });
  
  // Handle process signals
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
  
} catch (error) {
  console.error('=== FATAL ERROR DURING SERVER INIT ===');
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}