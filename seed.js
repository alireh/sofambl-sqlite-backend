const db = require("./db");
const bcrypt = require("bcryptjs");

db.serialize(() => {
  // ✅ جدول منو
  db.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT,
      order_index INTEGER
    )
  `);

  // ✅ جدول یوزر
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      is_admin INTEGER
    )
  `);

  //Collection
  db.run(`
  CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      desktop_image TEXT NOT NULL,
      mobile_image TEXT NOT NULL
  );
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
  );
  `);
  //Collection

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

  // ✅ seed ادمین (نسخه امن)
  db.get("SELECT COUNT(*) as count FROM users", async (err, row) => {
    if (err) {
      console.error("Users count error:", err);
      return;
    }

    if (!row || row.count === 0) {
      const hashed = await bcrypt.hash("admin123", 10);

      db.run(
        "INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)",
        ["admin", hashed, 1],
        (err) => {
          if (err) {
            console.error("Admin insert error:", err);
          } else {
            console.log("✅ Default admin created");
          }
        },
      );
    }
  });
});

//Hero
db.run(`
CREATE TABLE IF NOT EXISTS hero_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  desktop_image TEXT,
  mobile_image TEXT
)
`);

db.get("SELECT COUNT(*) as count FROM hero_settings", (err, row) => {
  if (!row || row.count === 0) {
    db.run(
      "INSERT INTO hero_settings (desktop_image, mobile_image) VALUES (?, ?)",
      ["/uploads/default-desktop.jpg", "/uploads/default-mobile.jpg"],
    );
    console.log("✅ Default hero images inserted");
  }
});
//Hero

//Collection
db.get("SELECT COUNT(*) as count FROM collections", (err, row) => {
  if (!row || row.count === 0) {
    db.run(`
      INSERT INTO collections (title, desktop_image, mobile_image)
      VALUES
        ('مبل','/uploads/default-desktop.jpg','/uploads/default-mobile.jpg'),
        ('اکسسوری','/uploads/default-desktop.jpg','/uploads/default-mobile.jpg')
    `);
    console.log("✅ Default hero images inserted");
  }
});

//Collection
