// db.js (برای MySQL)
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '.env');

console.log('📁 db.js: Loading .env from:', envPath);
dotenv.config({ path: envPath });

// بررسی متغیرهای محیطی
console.log('🔐 db.js: DB_USER:', process.env.DB_USER);
console.log('🔐 db.js: DB_DATABASE:', process.env.DB_DATABASE);

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'sofa',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'  // برای پشتیبانی فارسی
});

const db = {
  query: async (text, params) => {
    try {
      const [rows, fields] = await pool.execute(text, params);
      return { rows, fields };
    } catch (error) {
      console.error('Query error:', error.message);
      throw error;
    }
  },

  // برای INSERT, UPDATE, DELETE
  run: async (text, params) => {
    try {
      const [result] = await pool.execute(text, params);
      return {
        lastID: result.insertId,  // در MySQL insertId
        changes: result.affectedRows  // در MySQL affectedRows
      };
    } catch (error) {
      console.error('Run error:', error.message);
      throw error;
    }
  },

  // برای SELECT یک رکورد
  get: async (text, params = []) => {
    try {
      const [rows] = await pool.execute(text, params);
      return rows[0] || null;
    } catch (error) {
      console.error('Get error:', error.message);
      throw error;
    }
  },

  // برای SELECT چند رکورد
  all: async (text, params = []) => {
    try {
      const [rows] = await pool.execute(text, params);
      return rows;
    } catch (error) {
      console.error('All error:', error.message);
      throw error;
    }
  },

  // برای اجرای دستورات DDL
  exec: async (sql) => {
    try {
      await pool.execute(sql);
    } catch (error) {
      console.error('Exec error:', error.message);
      throw error;
    }
  },

  close: async () => {
    try {
      await pool.end();
      console.log('MySQL connection pool closed');
    } catch (error) {
      console.error('Close error:', error.message);
      throw error;
    }
  }
};

export default db;