const db = require("./db");
const bcrypt = require("bcryptjs");

db.serialize(() => {
  // ================= TABLES =================
  db.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT,
      order_index INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      is_admin INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      desktop_image TEXT NOT NULL,
      mobile_image TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sub_collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      image TEXT NOT NULL,
      price INTEGER NOT NULL,
      old_price INTEGER,
      FOREIGN KEY(collection_id) REFERENCES collections(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS hero_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      desktop_image TEXT,
      mobile_image TEXT
    )
  `);

  // ================= HERO SEED =================
  db.get("SELECT COUNT(*) as count FROM hero_settings", (err, row) => {
    if (!row || row.count === 0) {
      db.run(
        "INSERT INTO hero_settings (desktop_image, mobile_image) VALUES (?, ?)",
        ["/uploads/default-desktop.jpg", "/uploads/default-mobile.jpg"]
      );
      console.log("✅ Hero seeded");
    }
  });

  // ================= COLLECTION SEED =================
  db.get("SELECT COUNT(*) as count FROM collections", (err, row) => {
    if (!row || row.count === 0) {
      db.run(`
        INSERT INTO collections (title, desktop_image, mobile_image)
        VALUES
        ('مبل','/uploads/default-desktop.jpg','/uploads/default-mobile.jpg'),
        ('اکسسوری','/uploads/default-desktop.jpg','/uploads/default-mobile.jpg')
      `);
      console.log("✅ Collections seeded");
    }
  });

  // ================= SUB COLLECTION SEED =================
  db.get("SELECT COUNT(*) as count FROM sub_collections", (err, row) => {
    if (!row || row.count === 0) {
      console.log("🌱 Seeding sub_collections...");

      const insert = db.prepare(`
        INSERT INTO sub_collections
        (collection_id, name, image, price, old_price)
        VALUES (?, ?, ?, ?, ?)
      `);

      const seedData = [
        [1, "مبل راحتی سه نفره", "/uploads/mbel-1.webp", 4500000, 5200000],
        [1, "مبل تختخواب‌شو", "/uploads/mbel-2.webp", 5800000, null],
        [1, "مبل سه نفره", "/uploads/mbel-3.webp", 4500000, 5200000],
        [1, "مبل خول", "/uploads/mbel-4.webp", 5800000, null],
        [2, "آینه دکوراتیو طلایی", "/uploads/accessory-1.webp", 850000, null],
        [2, "گلدان سرامیکی", "/uploads/accessory-2.webp", 450000, null],
        [2, "آینه دکوراتیو نقره ای", "/uploads/accessory-3.webp", 850000, null],
        [2, "گلدان طلایی", "/uploads/accessory-4.webp", 450000, null],
      ];

      seedData.forEach((r) => insert.run(r));
      insert.finalize();

      console.log("✅ sub_collections seeded");
    }
  });

  // ================= ADMIN SEED =================
  db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
    if (!row || row.count === 0) {
      const hashed = await bcrypt.hash("admin123", 10);

      db.run(
        "INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)",
        ["admin", hashed, 1],
        () => console.log("✅ Admin created")
      );
    }
  });


  // ✅ seed منو
  db.get("SELECT COUNT(*) as count FROM menu_items", (err, row) => {
    if (err) {
      console.error("Menu count error:", err);
      return;
    }

    if (!row || row.count === 0) {
      const items = [
        ["خانه", "#", 1],
        ["مبل", "#", 2],
        ["اکسسوری", "#", 3],
        ["کنسول", "#", 4],
        ["میز غذاخوری", "#", 5],
        ["جلومبلی", "#", 6],
        ["محصولات", "#", 7],
        ["سرویس خواب", "#", 8],
        ["تماس با ما", "#", 9],
      ];

      const stmt = db.prepare(
        "INSERT INTO menu_items (title, url, order_index) VALUES (?, ?, ?)",
      );

      items.forEach((item) => stmt.run(item));
      stmt.finalize();

      console.log("✅ Menu seed inserted");
    }
  });
});