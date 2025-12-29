import db from './db.js';
import bcrypt from 'bcryptjs';

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT,
      type TEXT DEFAULT 'gallery',
      price INTEGER NOT NULL,
      off INTEGER NULL,
      is_tooman BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      about TEXT DEFAULT '',
      address TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      image_url TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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
    );

    CREATE TABLE IF NOT EXISTS social_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      icon TEXT,
      is_active BOOLEAN DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY,
      show_carousel BOOLEAN DEFAULT 1,
      max_carousel_items INTEGER DEFAULT 5,
      article_display_mode TEXT DEFAULT 'card',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // seed site
  if (!db.prepare(`SELECT 1 FROM site WHERE id=1`).get()) {
    db.prepare(`
      INSERT INTO site (id, about, address, email, phone)
      VALUES (1, 'درباره ما', 'تهران', 'info@test.com', '09120000000')
    `).run();
  }

  // seed settings
  if (!db.prepare(`SELECT 1 FROM site_settings WHERE id=1`).get()) {
    db.prepare(`
      INSERT INTO site_settings (id, show_carousel, max_carousel_items, article_display_mode)
      VALUES (1, 1, 5, 'card')
    `).run();
  }

  // seed admin
  if (!db.prepare(`SELECT 1 FROM admins WHERE email=?`).get('admin@example.com')) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO admins (email, password)
      VALUES (?, ?)
    `).run('admin@example.com', hash);
  }

  console.log('✅ Database initialized (tables checked & seeded)');
}
