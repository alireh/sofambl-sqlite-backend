// db.js
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('=== DATABASE INITIALIZATION ===');
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('NODE_ENV:', process.env.NODE_ENV);

// تعیین مسیر دیتابیس
let dbPath;
if (process.env.NODE_ENV === 'production') {
  // در Railway از مسیر persistent
  dbPath = 'database.sqlite';
  console.log('Using production database path:', dbPath);
  
  // ایجاد پوشه /data اگر وجود ندارد
  if (!fs.existsSync('/data')) {
    try {
      fs.mkdirSync('/data', { recursive: true });
      console.log('Created /data directory');
    } catch (err) {
      console.error('Error creating /data directory:', err.message);
      // Fallback to local path
      dbPath = join(__dirname, 'database.sqlite');
    }
  }
} else {
  dbPath = join(__dirname, 'database.sqlite');
  console.log('Using development database path:', dbPath);
}

console.log('Final database path:', dbPath);

// اتصال به دیتابیس
let db;
try {
  db = new Database(dbPath);
  console.log('✅ Database connected successfully');
  
  // تنظیمات دیتابیس
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  
  console.log('Database settings applied');
} catch (error) {
  console.error('❌ Database connection error:', error.message);
  throw error;
}

export default db;