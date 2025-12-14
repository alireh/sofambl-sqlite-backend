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

export default db;
