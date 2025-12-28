// init-db.js
import db from './db.js';
import bcrypt from 'bcryptjs';

export function initDatabase() {
  console.log('=== INITIALIZING DATABASE TABLES ===');
  
  try {
    // ایجاد جدول articles
    db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ایجاد جدول images
    db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT,
        type TEXT DEFAULT 'gallery',
        price INTEGER DEFAULT 0,
        off INTEGER DEFAULT 0,
        is_tooman BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ایجاد جدول site
    db.exec(`
      CREATE TABLE IF NOT EXISTS site (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        about TEXT DEFAULT '',
        address TEXT DEFAULT '',
        email TEXT DEFAULT '',
        phone TEXT DEFAULT ''
      )
    `);

    // ایجاد جدول admins
    db.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ایجاد جدول categories
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        image_url TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ایجاد جدول products
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        image_url TEXT NOT NULL,
        price REAL NOT NULL,
        discount_percent INTEGER DEFAULT 0,
        description TEXT,
        features TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      )
    `);

    // ایجاد جدول social_links
    db.exec(`
      CREATE TABLE IF NOT EXISTS social_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
        icon TEXT,
        is_active BOOLEAN DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ایجاد جدول site_settings
    db.exec(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id INTEGER PRIMARY KEY,
        show_carousel BOOLEAN DEFAULT 1,
        max_carousel_items INTEGER DEFAULT 5,
        article_display_mode TEXT DEFAULT 'card',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database tables created');

    // مقداردهی اولیه جدول site
    const siteExists = db.prepare(`SELECT id FROM site WHERE id=1`).get();
    if (!siteExists) {
      db.prepare(`
        INSERT INTO site (id, about, address, email, phone)
        VALUES (1, 'درباره ما', 'تهران', 'info@test.com', '09120000000')
      `).run();
      console.log('✅ Default site data inserted');
    }

    // مقداردهی اولیه جدول site_settings
    const settingsExist = db.prepare(`SELECT id FROM site_settings WHERE id=1`).get();
    if (!settingsExist) {
      db.prepare(`
        INSERT INTO site_settings (id, show_carousel, max_carousel_items, article_display_mode)
        VALUES (1, 1, 5, 'card')
      `).run();
      console.log('✅ Default site settings inserted');
    }

    // ایجاد کاربر ادمین پیش‌فرض
    const adminExists = db.prepare(`SELECT id FROM admins WHERE email=?`).get('admin@example.com');
    if (!adminExists) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      db.prepare(`
        INSERT INTO admins (email, password)
        VALUES (?, ?)
      `).run('admin@example.com', hashedPassword);
      console.log('✅ Default admin created');
    }

    console.log('================================');
    console.log('Default admin credentials:');
    console.log('📧 Email: admin@example.com');
    console.log('🔑 Password: admin123');
    console.log('================================');

    return true;
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    throw error;
  }
}