import Database from 'better-sqlite3';

const db = new Database('database.sqlite');

// tables
db.prepare(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS site (
    id INTEGER PRIMARY KEY,
    about TEXT,
    address TEXT,
    email TEXT,
    phone TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT,
    title TEXT,
    type TEXT
  )
`).run();

// seed site (one row)
const siteExists = db.prepare(`SELECT id FROM site WHERE id=1`).get();
if (!siteExists) {
  db.prepare(`
    INSERT INTO site (id, about, address, email, phone)
    VALUES (1, 'درباره ما', 'تهران', 'info@test.com', '09120000000')
  `).run();
}

// اضافه کردن جدول دسته‌بندی‌ها
db.prepare(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    image_url TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// اضافه کردن جدول محصولات
db.prepare(`
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
`).run();

// اضافه کردن جدول لینک‌های شبکه‌های اجتماعی
db.prepare(`
  CREATE TABLE IF NOT EXISTS social_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    icon TEXT,
    is_active BOOLEAN DEFAULT 1,
    display_order INTEGER DEFAULT 0
  )
`).run();

// اضافه کردن جدول تنظیمات سایت
db.prepare(`
  CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY,
    show_carousel BOOLEAN DEFAULT 1,
    max_carousel_items INTEGER DEFAULT 5,
    article_display_mode TEXT DEFAULT 'card', -- 'card' یا 'separate'
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// seed social links
// const socialPlatforms = [
//   { platform: 'telegram', url: '#', icon: 'telegram-icon.png' },
//   { platform: 'instagram', url: '#', icon: 'instagram-icon.png' },
//   { platform: 'pinterest', url: '#', icon: 'pinterest-icon.png' },
//   { platform: 'aparat', url: '#', icon: 'aparat-icon.png' },
//   { platform: 'youtube', url: '#', icon: 'youtube-icon.png' },
//   { platform: 'whatsapp', url: '#', icon: 'whatsapp-icon.png' }
// ];

// socialPlatforms.forEach(platform => {
//   const exists = db.prepare(`SELECT id FROM social_links WHERE platform=?`).get(platform.platform);
//   if (!exists) {
//     db.prepare(`
//       INSERT INTO social_links (platform, url, icon)
//       VALUES (?, ?, ?)
//     `).run(platform.platform, platform.url, platform.icon);
//   }
// });

// seed site settings
const settingsExist = db.prepare(`SELECT id FROM site_settings WHERE id=1`).get();
if (!settingsExist) {
  db.prepare(`
    INSERT INTO site_settings (id, show_carousel, max_carousel_items, article_display_mode)
    VALUES (1, 1, 5, 'card')
  `).run();
}
const socialPlatforms = [
  {
    platform: 'telegram',
    url: '#',
    icon: 'telegram',
    display_order: 1
  },
  {
    platform: 'instagram',
    url: '#',
    icon: 'instagram',
    display_order: 2
  },
  {
    platform: 'pinterest',
    url: '#',
    icon: 'pinterest',
    display_order: 3
  },
  {
    platform: 'aparat',
    url: '#',
    icon: 'aparat',
    display_order: 4
  },
  {
    platform: 'youtube',
    url: '#',
    icon: 'youtube',
    display_order: 5
  },
  {
    platform: 'whatsapp',
    url: '#',
    icon: 'whatsapp',
    display_order: 6
  }
];

socialPlatforms.forEach(platform => {
  const exists = db.prepare(`SELECT id FROM social_links WHERE platform=?`).get(platform.platform);
  if (!exists) {
    db.prepare(`
      INSERT INTO social_links (platform, url, icon, display_order)
      VALUES (?, ?, ?, ?)
    `).run(platform.platform, platform.url, platform.icon, platform.display_order);
  }
});

export default db;
