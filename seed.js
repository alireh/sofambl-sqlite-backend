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

  db.run(`
  CREATE TABLE IF NOT EXISTS best_sellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    image TEXT NOT NULL,
    rating REAL NOT NULL,
    price INTEGER NOT NULL
  );
`);

  db.run(`
      CREATE TABLE IF NOT EXISTS common_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL
      );
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

  // ================= Best Sellers =================
  db.get("SELECT COUNT(*) as count FROM best_sellers", (err, row) => {
    if (!row || row.count === 0) {
      console.log("🌱 Seeding best_sellers...");

      const insert = db.prepare(`
        INSERT INTO best_sellers
        (title, image, rating, price)
        VALUES (?, ?, ?, ?)
      `);

      const seedData = [
        ["مبل راحتی شیک",
          "/uploads/default-desktop.jpg",
          4.5,
          3500000],
        [
          "میز ناهارخوری لوکس",
          "/uploads/best_sellers2.webp",
          4.8,
          5200000],
        ["کنسول مدرن",
          "/uploads/best_sellers3.webp",
          4.3,
          2800000],
        ["اکسسوری دکوری",
          "/uploads/best_sellers4.webp",
          4.6,
          850000],
      ];

      seedData.forEach((r) => insert.run(r));
      insert.finalize();

      console.log("✅ best_sellers seeded");
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


  db.get("SELECT COUNT(*) as count FROM common_questions", (err, row) => {
    if (!row || row.count === 0) {
      console.log("🌱 Seeding common_questions...");

      const insert = db.prepare(`
        INSERT INTO common_questions
        (question, answer)
        VALUES (?, ?)
      `);

      const seedData = [
        [
          'بهترین نوع پارچه برای مبلمان چیست؟',
          'پارچه‌های مخمل، کتان و میکروفایبر از بهترین گزینه‌ها هستند. مخمل برای مجالس رسمی، کتان برای استفاده روزمره و میکروفایبر برای خانواده‌های دارای کودک مناسب‌تر است.'
        ],
        [
          'چگونه از مبلمان چرمی مراقبت کنیم؟',
          'از مواد شوینده قوی استفاده نکنید، هر ماه با دستمال مرطوب تمیز کنید، از تابش مستقیم نور خورشید دور نگه دارید و هر ۶ ماه یکبار از نرم‌کننده چرم استفاده کنید.'
        ],
        [
          'مدت زمان تحویل سفارش چقدر است؟',
          'محصولات آماده ۳ تا ۵ روز کاری و محصولات سفارشی ۱۵ تا ۲۰ روز کاری تحویل داده می‌شوند. زمان دقیق پس از ثبت سفارش به شما اعلام خواهد شد.'
        ],
        [
          'آیا امکان بازگشت کالا وجود دارد؟',
          'بله، تا ۷ روز پس از تحویل کالا در صورت عدم استفاده و حفظ بسته‌بندی اصلی، امکان بازگشت وجود دارد. هزینه بازگشت بر عهده مشتری است.'
        ],
        [
          'چگونه ابعاد مناسب مبلمان را انتخاب کنیم؟',
          'ابتدا فضای مورد نظر را اندازه‌گیری کنید، سپس با در نظر گرفتن ۷۰ سانتیمتر فضای رفت و آمد، ابعاد مناسب را انتخاب کنید. تیم مشاوره ما رایگان شما را راهنمایی می‌کند.'
        ],
        [
          'آیا گارانتی دارید؟',
          'بله، تمام محصولات دارای ۱۸ ماه گارانتی در برابر شکستگی اسکلت و ۶ ماه گارانتی پارچه هستند.'
        ],
        [
          'روش‌های پرداخت چیست؟',
          'پرداخت آنلاین، کارت به کارت و پرداخت در محل (فقط برای تهران) امکان‌پذیر است.'
        ],
        [
          'آیا امکان خرید اقساطی وجود دارد؟',
          'بله، از طریق همکاری با چند بانک، امکان خرید اقساطی تا ۱۲ ماه فراهم شده است.'
        ],
        [
          'چگونه از اصالت کالا مطمئن شویم؟',
          'همه محصولات با هولوگرام و کد رهگیری ارائه می‌شوند. با اسکن QR کد روی محصول، اطلاعات کامل و اصالت کالا قابل استعلام است.'
        ],
        [
          'آیا خدمات پس از فروش دارید؟',
          'بله، تا ۵ سال خدمات پس از فروش شامل تعمیرات، تعویض پارچه و شستشوی تخصصی با ۳۰٪ تخفیف ارائه می‌شود.'
        ]
      ];

      seedData.forEach((r) => insert.run(r));
      insert.finalize();

      console.log("✅ common_questions seeded");
    }
  });


});