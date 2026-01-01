/* ================== ENV ================== */
import dotenv from 'dotenv';
dotenv.config();

/* ================== CORE ================== */
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { fileURLToPath } from 'url';

/* ================== LOCAL ================== */
import db from './db.js';
import { initDatabase } from './init-db.js';
import { adminAuth } from './auth.js';
import { fillDb } from './fill-db.js';

/* ================== PATH FIX ================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================== APP ================== */
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================== STATIC ================== */
const UPLOAD_ROOT = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

app.use('/uploads', express.static(UPLOAD_ROOT));

/* ================== MULTER ================== */
const storage = multer.diskStorage({
  destination(req, file, cb) {
    let uploadPath = UPLOAD_ROOT;

    if (req.path.includes('socials')) uploadPath += '/socials';
    else if (req.path.includes('carousel')) uploadPath += '/carousel';
    else if (req.path.includes('articles')) uploadPath += '/articles';
    else if (req.path.includes('products')) uploadPath += '/products';
    else if (req.path.includes('categories')) uploadPath += '/categories';

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename(req, file, cb) {
    const name =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ok = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
    cb(ok.includes(file.mimetype) ? null : new Error('Invalid file type'), true);
  }
});



app.get('/api/admin/data', adminAuth, (_, res) => {
  const site = db.prepare(`SELECT * FROM site WHERE id=1`).get();
  const images = db.prepare(`SELECT * FROM images WHERE type!='carousel'`).all();
  const carouselImages = db.prepare(`SELECT * FROM images WHERE type='carousel'`).all();
  const articles = db.prepare(`SELECT * FROM articles ORDER BY created_at DESC`).all();
  const categories = db.prepare(`SELECT * FROM categories ORDER BY created_at DESC`).all();
  const products = db.prepare(`SELECT * FROM products ORDER BY created_at DESC`).all();
  const socialLinks = db.prepare(`SELECT * FROM social_links ORDER BY display_order`).all();
  const settings = db.prepare(`SELECT * FROM site_settings WHERE id=1`).get();

  res.json({
    ...site,
    images,
    carouselImages,
    articles,
    categories,
    products,
    socialLinks,
    settings
  });
});

app.get("/api/data", (_, res) => {
  const site = db.prepare(`SELECT * FROM site WHERE id=1`).get();
  const images = db.prepare(`SELECT * FROM images WHERE type!='carousel'`).all();
  const settings = db.prepare(`SELECT * FROM site_settings WHERE id=1`).get();
  const carouselImages = db.prepare(`
    SELECT * FROM images WHERE type='carousel' ORDER BY id DESC LIMIT ?
  `).all(settings.max_carousel_items);
  const socialLinks = db.prepare(`
    SELECT * FROM social_links  WHERE is_active = 1 ORDER BY display_order
  `).all();
  res.json({
    ...site,
    images,
    carouselImages,
    settings,
    socialLinks
  });
});

app.put('/api/admin/update-content', adminAuth, (req, res) => {
  const { about, address, email, phone } = req.body;

  db.prepare(`
    UPDATE site SET
      about = COALESCE(?, about),
      address = COALESCE(?, address),
      email = COALESCE(?, email),
      phone = COALESCE(?, phone)
    WHERE id=1
  `).run(about, address, email, phone);

  res.json({ success: true });
});

/* ---------- CONTACT MESSAGES ---------- */

// POST: ارسال پیام تماس جدید (عمومی)
app.post('/api/contact', (req, res) => {
  try {
    const { name, email, message } = req.body;

    // اعتبارسنجی داده‌ها
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'نام الزامی است'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'ایمیل الزامی است'
      });
    }

    // اعتبارسنجی فرمت ایمیل
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: 'فرمت ایمیل نامعتبر است'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'متن پیام الزامی است'
      });
    }

    // بررسی تعداد پیام‌های اخیر از این ایمیل (برای جلوگیری از اسپم)
    const recentMessages = db.prepare(`
      SELECT COUNT(*) as count 
      FROM contact_messages 
      WHERE email = ? AND created_at > datetime('now', '-1 hour')
    `).get(email.trim());

    if (recentMessages.count >= 5) {
      return res.status(429).json({
        success: false,
        error: 'تعداد پیام‌های شما در یک ساعت گذشته زیاد بوده است. لطفاً کمی صبر کنید.'
      });
    }

    // ذخیره پیام در دیتابیس
    const result = db.prepare(`
      INSERT INTO contact_messages (name, email, message)
      VALUES (?, ?, ?)
    `).run(
      name.trim(),
      email.trim(),
      message.trim()
    );

    // دریافت پیام ذخیره شده
    const savedMessage = db.prepare(`
      SELECT * FROM contact_messages WHERE id = ?
    `).get(result.lastInsertRowid);

    console.log('پیام جدید ذخیره شد:', {
      id: savedMessage.id,
      name: savedMessage.name,
      email: savedMessage.email,
      time: savedMessage.created_at
    });

    res.status(201).json({
      success: true,
      message: 'پیام شما با موفقیت ثبت شد',
      data: {
        id: savedMessage.id,
        created_at: savedMessage.created_at
      }
    });

  } catch (error) {
    console.error('خطا در ثبت پیام:', error);

    // بررسی خطای UNIQUE constraint (اگر داشتید)
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({
        success: false,
        error: 'این ایمیل قبلاً ثبت شده است'
      });
    }

    res.status(500).json({
      success: false,
      error: 'خطا در ثبت پیام. لطفاً مجدداً تلاش کنید'
    });
  }
});

// GET: دریافت تمام پیام‌ها (برای ادمین)
app.get('/api/admin/contact-messages', adminAuth, (req, res) => {
  try {
    // پارامترهای جستجو و فیلتر
    const {
      page = 1,
      limit = 20,
      search = '',
      read = '',
      sort = 'newest'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // ساختن شرط‌های WHERE
    let whereConditions = [];
    let params = [];

    if (search) {
      whereConditions.push('(name LIKE ? OR email LIKE ? OR message LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (read === 'read') {
      whereConditions.push('is_read = 1');
    } else if (read === 'unread') {
      whereConditions.push('is_read = 0');
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // تعیین ترتیب بر اساس پارامتر sort
    let orderBy = 'created_at DESC'; // پیش‌فرض جدیدترین
    if (sort === 'oldest') {
      orderBy = 'created_at ASC';
    } else if (sort === 'name') {
      orderBy = 'name ASC';
    } else if (sort === 'email') {
      orderBy = 'email ASC';
    }

    // دریافت پیام‌ها
    const messages = db.prepare(`
      SELECT * FROM contact_messages 
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    // تعداد کل پیام‌ها برای pagination
    const totalResult = db.prepare(`
      SELECT COUNT(*) as total FROM contact_messages ${whereClause}
    `).get(...params);

    // آمار برای نمایش در داشبورد
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
        SUM(CASE WHEN DATE(created_at) = DATE('now') THEN 1 ELSE 0 END) as today
      FROM contact_messages
    `).get();

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult.total,
          totalPages: Math.ceil(totalResult.total / parseInt(limit))
        },
        stats
      }
    });

  } catch (error) {
    console.error('خطا در دریافت پیام‌ها:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در دریافت پیام‌ها'
    });
  }
});

// GET: دریافت یک پیام خاص (برای ادمین)
app.get('/api/admin/contact-messages/:id', adminAuth, (req, res) => {
  try {
    const { id } = req.params;

    const message = db.prepare(`
      SELECT * FROM contact_messages WHERE id = ?
    `).get(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'پیام پیدا نشد'
      });
    }

    res.json({
      success: true,
      data: message
    });

  } catch (error) {
    console.error('خطا در دریافت پیام:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در دریافت پیام'
    });
  }
});

// PUT: علامت‌گذاری پیام به عنوان خوانده شده (برای ادمین)
app.put('/api/admin/contact-messages/:id/read', adminAuth, (req, res) => {
  try {
    const { id } = req.params;

    // بررسی وجود پیام
    const existing = db.prepare(`
      SELECT * FROM contact_messages WHERE id = ?
    `).get(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'پیام پیدا نشد'
      });
    }

    // به‌روزرسانی وضعیت خوانده شدن
    db.prepare(`
      UPDATE contact_messages 
      SET is_read = 1 
      WHERE id = ?
    `).run(id);

    res.json({
      success: true,
      message: 'پیام به عنوان خوانده شده علامت‌گذاری شد'
    });

  } catch (error) {
    console.error('خطا در به‌روزرسانی پیام:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در به‌روزرسانی پیام'
    });
  }
});

// PUT: به‌روزرسانی وضعیت خوانده/نخوانده (برای ادمین)
app.put('/api/admin/contact-messages/:id', adminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { is_read } = req.body;

    // بررسی وجود پیام
    const existing = db.prepare(`
      SELECT * FROM contact_messages WHERE id = ?
    `).get(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'پیام پیدا نشد'
      });
    }

    // به‌روزرسانی وضعیت
    db.prepare(`
      UPDATE contact_messages 
      SET is_read = ? 
      WHERE id = ?
    `).run(is_read ? 1 : 0, id);

    res.json({
      success: true,
      message: `پیام با موفقیت ${is_read ? 'خوانده' : 'نخوانده'} شد`
    });

  } catch (error) {
    console.error('خطا در به‌روزرسانی پیام:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در به‌روزرسانی پیام'
    });
  }
});

// DELETE: حذف یک پیام (برای ادمین)
app.delete('/api/admin/contact-messages/:id', adminAuth, (req, res) => {
  try {
    const { id } = req.params;

    // بررسی وجود پیام
    const existing = db.prepare(`
      SELECT * FROM contact_messages WHERE id = ?
    `).get(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'پیام پیدا نشد'
      });
    }

    // حذف پیام
    db.prepare(`
      DELETE FROM contact_messages WHERE id = ?
    `).run(id);

    console.log('پیام حذف شد:', { id, name: existing.name, email: existing.email });

    res.json({
      success: true,
      message: 'پیام با موفقیت حذف شد'
    });

  } catch (error) {
    console.error('خطا در حذف پیام:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در حذف پیام'
    });
  }
});

// DELETE: حذف چندین پیام (برای ادمین)
app.delete('/api/admin/contact-messages', adminAuth, (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'لیست شناسه‌های پیام‌ها الزامی است'
      });
    }

    // حذف پیام‌ها
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`
      DELETE FROM contact_messages 
      WHERE id IN (${placeholders})
    `);

    const result = stmt.run(...ids);

    console.log(`${result.changes} پیام حذف شد`);

    res.json({
      success: true,
      message: `${result.changes} پیام با موفقیت حذف شدند`
    });

  } catch (error) {
    console.error('خطا در حذف پیام‌ها:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در حذف پیام‌ها'
    });
  }
});

// GET: دریافت آمار پیام‌ها برای داشبورد (برای ادمین)
app.get('/api/admin/contact-stats', adminAuth, (req, res) => {
  try {
    // آمار کلی
    const overallStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
        SUM(CASE WHEN DATE(created_at) = DATE('now') THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN DATE(created_at) = DATE('now', '-1 day') THEN 1 ELSE 0 END) as yesterday
      FROM contact_messages
    `).get();

    // آمار هفتگی
    const weeklyStats = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM contact_messages
      WHERE created_at >= DATE('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all();

    res.json({
      success: true,
      data: {
        overall: overallStats,
        weekly: weeklyStats
      }
    });

  } catch (error) {
    console.error('خطا در دریافت آمار:', error);
    res.status(500).json({
      success: false,
      error: 'خطا در دریافت آمار'
    });
  }
});

// GET site settings (public)
app.get('/api/site-settings', (_, res) => {
  const settings = db.prepare(`SELECT * FROM site_settings WHERE id=1`).get();
  const carouselImages = db.prepare(`
    SELECT * FROM images WHERE type='carousel' ORDER BY id DESC LIMIT ?
  `).all(settings.max_carousel_items);
  const images = db.prepare(`
    SELECT * FROM images WHERE type!='carousel' ORDER BY id DESC LIMIT ?
  `).all(settings.max_carousel_items);

  res.json({ ...settings, carouselImages, images });
});

// UPDATE site settings (admin)
app.put('/api/admin/site-settings', adminAuth, (req, res) => {
  const { max_carousel_items, article_display_mode } = req.body;
  const show_carousel = req.body.show_carousel ? 1 : 0;

  db.prepare(`
    UPDATE site_settings 
    SET show_carousel = COALESCE(?, show_carousel),
        max_carousel_items = COALESCE(?, max_carousel_items),
        article_display_mode = COALESCE(?, article_display_mode),
        updated_at = datetime('now')
    WHERE id=1
  `).run(show_carousel, max_carousel_items, article_display_mode);

  const updated = db.prepare(`SELECT * FROM site_settings WHERE id=1`).get();
  res.json(updated);
});

app.delete('/api/admin/image/:id', adminAuth, (req, res) => {

  try {
    const imageId = req.params.id;
    const existing = db.prepare(`
    SELECT * FROM images WHERE id=?
  `).get(imageId);
    // حذف فایل تصویر از سیستم اگر وجود دارد
    if (existing.url) {
      const imagePath = existing.url.replace('/uploads/', 'uploads/');
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
  } catch (error) {
  }

  db.prepare(`DELETE FROM images WHERE id=?`).run(req.params.id);
  res.json({ success: true });
});

/* ================== HEALTH ================== */
app.get('/', (_, res) => res.send('API is running'));
app.get('/health', (_, res) => res.json({ status: 'ok' }));

/* ================== AUTH ================== */
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  const admin = db.prepare(`SELECT * FROM admins WHERE email=?`).get(email);

  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: admin.id, email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '1d' }
  );

  res.json({ token });
});

/* ================== UPLOAD IMAGE ================== */
app.post('/api/admin/upload', adminAuth, upload.single('image'), (req, res) => {
  db.prepare(`
    INSERT INTO images (url, title, type, price, off, is_tooman)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    `/uploads/${req.file.filename}`,
    req.body.title || 'image',
    req.body.type,
    req.body.price,
    req.body.off,
    req.body.is_tooman
  );

  res.json({ success: true });
});

/* ================== ARTICLES ================== */
app.get('/api/articles', (_, res) => {
  res.json(db.prepare(`SELECT * FROM articles ORDER BY created_at DESC`).all());
});

// GET all articles (admin - with more details if needed)
app.get('/api/admin/articles', adminAuth, (_, res) => {
  const articles = db.prepare(`
    SELECT * FROM articles 
    ORDER BY created_at DESC
  `).all();
  res.json(articles);
});
app.post('/api/admin/articles',
  adminAuth,
  upload.single('image'),
  (req, res) => {
    const imageUrl = req.file
      ? `/uploads/articles/${req.file.filename}`
      : null;

    const r = db.prepare(`
      INSERT INTO articles (title, content, image_url, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `).run(req.body.title, req.body.content, imageUrl);

    res.status(201).json(
      db.prepare(`SELECT * FROM articles WHERE id=?`).get(r.lastInsertRowid)
    );
  }
);
// PUT update article with optional image update
app.put('/api/admin/articles/:id', adminAuth, upload.single('image'), (req, res) => {
  const { title, content, removeImage } = req.body;
  const articleId = req.params.id;

  // Check if article exists
  const existing = db.prepare(`
    SELECT * FROM articles WHERE id=?
  `).get(articleId);

  if (!existing) {
    return res.status(404).json({ error: 'Article not found' });
  }

  let imageUrl = existing.image_url;

  // اگر فایل جدید آپلود شده
  if (req.file) {
    imageUrl = `/uploads/articles/${req.file.filename}`;
  }

  // اگر کاربر بخواهد تصویر را حذف کند
  if (removeImage === 'true') {
    imageUrl = null;
  }

  db.prepare(`
    UPDATE articles 
    SET 
      title = COALESCE(?, title),
      content = COALESCE(?, content),
      image_url = ?,
      updated_at = datetime('now')
    WHERE id=?
  `).run(title, content, imageUrl, articleId);

  const updatedArticle = db.prepare(`
    SELECT * FROM articles WHERE id=?
  `).get(articleId);

  res.json(updatedArticle);
});

// DELETE article (also delete the image file if exists)
app.delete('/api/admin/articles/:id', adminAuth, (req, res) => {
  const articleId = req.params.id;

  // Check if article exists
  const existing = db.prepare(`
    SELECT * FROM articles WHERE id=?
  `).get(articleId);

  if (!existing) {
    return res.status(404).json({ error: 'Article not found' });
  }

  // حذف فایل تصویر از سیستم اگر وجود دارد
  if (existing.image_url) {
    const imagePath = existing.image_url.replace('/uploads/articles/', 'uploads/articles/');
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }


  db.prepare(`
    DELETE FROM articles WHERE id=?
  `).run(articleId);

  res.json({ success: true, message: 'Article deleted successfully' });
});

/* ================== categories ================== */
app.get("/api/categories", (_, res) => {
  const categories = db.prepare(`
    SELECT c.*, 
           COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all();
  res.json(categories);
});

// GET all categories (admin - با اطلاعات کامل)
app.get('/api/admin/categories', adminAuth, (_, res) => {
  const categories = db.prepare(`
    SELECT c.*, 
           COUNT(p.id) as product_count,
           SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END) as active_products
    FROM categories c
    LEFT JOIN products p ON c.id = p.category_id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all();

  res.json(categories);
});
// CREATE category (admin)
app.post('/api/admin/categories', adminAuth, upload.single('image'), (req, res) => {
  const { title, description } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const imageUrl = req.file ? `/uploads/categories/${req.file.filename}` : null;

  const result = db.prepare(`
    INSERT INTO categories (title, image_url, description)
    VALUES (?, ?, ?)
  `).run(title, imageUrl, description);

  const newCategory = db.prepare(`
    SELECT * FROM categories WHERE id=?
  `).get(result.lastInsertRowid);

  res.status(201).json(newCategory);
});

// UPDATE category (admin)
app.put('/api/admin/categories/:id', adminAuth, upload.single('image'), (req, res) => {
  const { title, description, removeImage } = req.body;

  const existing = db.prepare(`SELECT * FROM categories WHERE id=?`).get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Category not found' });
  }

  let imageUrl = existing.image_url;
  if (req.file) {
    imageUrl = `/uploads/categories/${req.file.filename}`;
  }
  if (removeImage === 'true') {
    imageUrl = null;
  }

  db.prepare(`
    UPDATE categories 
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        image_url = ?
    WHERE id=?
  `).run(title, description, imageUrl, req.params.id);

  const updated = db.prepare(`SELECT * FROM categories WHERE id=?`).get(req.params.id);
  res.json(updated);
});

// DELETE category (admin)
app.delete('/api/admin/categories/:id', adminAuth, (req, res) => {
  // بررسی اینکه آیا محصولی در این دسته‌بندی وجود دارد
  const hasProducts = db.prepare(`
    SELECT COUNT(*) as count FROM products WHERE category_id=?
  `).get(req.params.id);

  if (hasProducts.count > 0) {
    return res.status(400).json({
      error: 'Cannot delete category with products. Delete products first.'
    });
  }

  // حذف تصویر دسته‌بندی
  const category = db.prepare(`SELECT * FROM categories WHERE id=?`).get(req.params.id);
  if (category.image_url) {
    const imagePath = category.image_url.replace('/uploads/categories/', 'uploads/categories/');
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }

  db.prepare(`DELETE FROM categories WHERE id=?`).run(req.params.id);
  res.json({ success: true });
});

/* ================== PRODUCTS ================== */
// app.post('/api/admin/products',
//   adminAuth,
//   upload.single('image'),
//   (req, res) => {
//     const imageUrl = `/uploads/products/${req.file.filename}`;

//     const r = db.prepare(`
//       INSERT INTO products
//       (category_id,title,image_url,price,discount_percent,description,features)
//       VALUES (?,?,?,?,?,?,?)
//     `).run(
//       req.body.category_id,
//       req.body.title,
//       imageUrl,
//       req.body.price,
//       req.body.discount_percent || 0,
//       req.body.description,
//       req.body.features
//     );

//     res.status(201).json(
//       db.prepare(`SELECT * FROM products WHERE id=?`).get(r.lastInsertRowid)
//     );
//   }
// );



// GET all products (public)
app.get('/api/products', (_, res) => {
  const products = db.prepare(`
    SELECT p.*, c.title as category_title
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1
    ORDER BY p.created_at DESC
  `).all();
  res.json(products);
});

// GET all products (admin)
app.get('/api/admin/products', adminAuth, (_, res) => {
  const products = db.prepare(`
    SELECT p.*, c.title as category_title
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.created_at DESC
  `).all();
  res.json(products);
});

// CREATE product (admin)
app.post('/api/admin/products', adminAuth, upload.single('image'), (req, res) => {
  const { category_id, title, price, discount_percent, description, features } = req.body;

  if (!category_id || !title || !price || !req.file) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const imageUrl = `/uploads/products/${req.file.filename}`;

  const result = db.prepare(`
    INSERT INTO products (category_id, title, image_url, price, discount_percent, description, features)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(category_id, title, imageUrl, price, discount_percent || 0, description, features);

  const newProduct = db.prepare(`SELECT * FROM products WHERE id=?`).get(result.lastInsertRowid);
  res.status(201).json(newProduct);
});


// UPDATE product (admin)
app.put('/api/admin/products/:id', adminAuth, upload.single('image'), (req, res) => {
  const { category_id, title, price, discount_percent, description, features, removeImage } = req.body;

  const existing = db.prepare(`SELECT * FROM products WHERE id=?`).get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found' });
  }

  let imageUrl = existing.image_url;
  if (req.file) {
    imageUrl = `/uploads/products/${req.file.filename}`;
  }
  if (removeImage === 'true') {
    imageUrl = existing.image_url; // حذف تصویر مجاز نیست، فقط می‌توان جایگزین کرد
  }

  db.prepare(`
    UPDATE products 
    SET category_id = COALESCE(?, category_id),
        title = COALESCE(?, title),
        price = COALESCE(?, price),
        discount_percent = COALESCE(?, discount_percent),
        description = COALESCE(?, description),
        features = COALESCE(?, features),
        image_url = COALESCE(?, image_url)
    WHERE id=?
  `).run(category_id, title, price, discount_percent, description, features, imageUrl, req.params.id);

  const updated = db.prepare(`SELECT * FROM products WHERE id=?`).get(req.params.id);
  res.json(updated);
});

app.delete('/api/admin/products/:id', adminAuth, (req, res) => {
  const { id } = req.params;

  // Check if product exists
  const existing = db.prepare(`
    SELECT * FROM products WHERE id=?
  `).get(id);

  if (!existing) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // حذف فایل تصویر از سیستم
  if (existing.image_url) {
    const imagePath = existing.image_url.replace('/uploads/products/', 'uploads/products/');
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }

  db.prepare(`
    DELETE FROM products WHERE id=?
  `).run(id);

  res.json({ success: true, message: 'Product deleted successfully' });
});

/* ================== CAROUSEL ================== */
// به‌روزرسانی API داده‌ها برای شامل کردن اطلاعات جدید
app.get('/api/data', (_, res) => {
  const site = db.prepare(`SELECT * FROM site WHERE id=1`).get();
  const images = db.prepare(`SELECT * FROM images WHERE type!='carousel'`).all();
  const settings = db.prepare(`SELECT * FROM site_settings WHERE id=1`).get();
  const carouselImages = db.prepare(`
    SELECT * FROM images WHERE type='carousel' ORDER BY id DESC LIMIT ?
  `).all(settings.max_carousel_items);
  const socialLinks = db.prepare(`
    SELECT * FROM social_links  WHERE is_active = 1 ORDER BY display_order
  `).all();

  res.json({
    ...site,
    images,
    carouselImages,
    settings,
    socialLinks
  });
});

app.get('/api/admin/data', adminAuth, (_, res) => {
  const site = db.prepare(`SELECT * FROM site WHERE id=1`).get();
  const images = db.prepare(`SELECT * FROM images WHERE type!='carousel'`).all();
  const carouselImages = db.prepare(`SELECT * FROM images WHERE type='carousel'`).all();
  const articles = db.prepare(`SELECT * FROM articles ORDER BY created_at DESC`).all();
  const categories = db.prepare(`SELECT * FROM categories ORDER BY created_at DESC`).all();
  const products = db.prepare(`SELECT * FROM products ORDER BY created_at DESC`).all();
  const socialLinks = db.prepare(`SELECT * FROM social_links ORDER BY display_order`).all();
  const settings = db.prepare(`SELECT * FROM site_settings WHERE id=1`).get();

  res.json({
    ...site,
    images,
    carouselImages,
    articles,
    categories,
    products,
    socialLinks,
    settings
  });
});
// آپلود تصویر برای carousel
app.post('/api/admin/carousel', adminAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Image is required' });
  }

  // بررسی تعداد تصاویر موجود
  const settings = db.prepare(`SELECT max_carousel_items FROM site_settings WHERE id=1`).get();
  const currentCount = db.prepare(`SELECT COUNT(*) as count FROM images WHERE type='carousel'`).get();

  if (currentCount.count >= settings.max_carousel_items) {
    return res.status(400).json({
      error: `Maximum ${settings.max_carousel_items} carousel images allowed`
    });
  }

  db.prepare(`
    INSERT INTO images (url, title, type, price, off, is_tooman)
    VALUES (?, ?, 'carousel', 0,0,true)
  `).run(`/uploads/carousel/${req.file.filename}`, req.body.title || 'Carousel Image');

  res.json({ success: true });
});

// حذف تصویر carousel
app.delete('/api/admin/carousel/:id', adminAuth, (req, res) => {
  const image = db.prepare(`SELECT * FROM images WHERE id=? AND type='carousel'`).get(req.params.id);

  if (!image) {
    return res.status(404).json({ error: 'Carousel image not found' });
  }

  // حذف فایل
  const imagePath = image.url.replace('/uploads/carousel/', 'uploads/carousel/');
  if (fs.existsSync(imagePath)) {
    fs.unlinkSync(imagePath);
  }

  db.prepare(`DELETE FROM images WHERE id=?`).run(req.params.id);
  res.json({ success: true });
});

/* ================== SOCIALS ================== */
app.get('/api/socials', (_, res) => {
  res.json(
    db.prepare(`
      SELECT * FROM social_links
      WHERE is_active=1
      ORDER BY display_order
    `).all()
  );
});


// GET all social links (admin - با همه اطلاعات)
app.get('/api/admin/socials', adminAuth, (_, res) => {
  const links = db.prepare(`
    SELECT * FROM social_links 
    ORDER BY display_order
  `).all();
  res.json(links);
});


app.post('/api/admin/socials', adminAuth, upload.single('icon'), (req, res) => {
  try {
    console.log('=== Social Link Upload Request ===');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    console.log('Request headers:', req.headers['content-type']);

    const { platform, url, display_order } = req.body;

    // اعتبارسنجی
    if (!platform || !platform.trim()) {
      return res.status(400).json({ error: 'نام پلتفرم الزامی است' });
    }

    if (!url || !url.trim()) {
      return res.status(400).json({ error: 'آدرس URL الزامی است' });
    }

    // بررسی اینکه آیا پلتفرم از قبل وجود دارد
    const existing = db.prepare(`
      SELECT id FROM social_links WHERE LOWER(platform)=LOWER(?)
    `).get(platform.trim());

    if (existing) {
      return res.status(400).json({ error: 'این نام پلتفرم قبلاً ثبت شده است' });
    }

    // مدیریت آپلود تصویر - بررسی وجود فایل
    if (!req.file) {
      console.log('No file uploaded!');
      return res.status(400).json({ error: 'تصویر آیکون الزامی است' });
    }

    console.log('File uploaded successfully:', req.file);

    const iconUrl = `/uploads/socials/${req.file.filename}`;

    // بررسی اینکه فایل واقعاً در سرور وجود دارد
    const filePath = path.join(__dirname, 'uploads', 'socials', req.file.filename);
    // if (!fs.existsSync(filePath)) {
    //   console.error('File not found on server:', filePath);
    //   return res.status(500).json({ error: 'خطا در ذخیره فایل' });
    // }

    console.log('File saved at:', filePath);

    const result = db.prepare(`
      INSERT INTO social_links (platform, url, icon, display_order, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(
      platform.trim(),
      url.trim(),
      iconUrl,
      display_order || 0
    );

    const newLink = db.prepare(`
      SELECT * FROM social_links WHERE id=?
    `).get(result.lastInsertRowid);

    console.log('Social link created:', newLink);

    res.status(201).json(newLink);

  } catch (error) {
    console.error('Error in social link creation:', error);
    res.status(500).json({ error: 'خطای سرور' });
  }
});

app.put('/api/admin/socials/:id', adminAuth, upload.single('icon'), (req, res) => {
  try {
    console.log('=== Update Social Link Request ===');
    console.log('ID:', req.params.id);
    console.log('Body:', req.body);
    console.log('File:', req.file);
    console.log('Remove icon:', req.body.remove_icon);

    const { platform, url, is_active, display_order, remove_icon } = req.body;
    const linkId = req.params.id;

    // اعتبارسنجی ID
    if (!linkId || isNaN(parseInt(linkId))) {
      return res.status(400).json({ error: 'شناسه معتبر الزامی است' });
    }

    // بررسی وجود لینک
    const existing = db.prepare(`
      SELECT * FROM social_links WHERE id = ?
    `).get(linkId);

    if (!existing) {
      return res.status(404).json({ error: 'شبکه اجتماعی پیدا نشد' });
    }

    // آماده‌سازی مقادیر برای به‌روزرسانی
    const updateFields = {
      platform: platform !== undefined ? platform.trim() : existing.platform,
      url: url !== undefined ? url.trim() : existing.url,
      is_active: is_active !== undefined ?
        (is_active === 'true' || is_active === true || is_active === 1 ? 1 : 0) :
        existing.is_active,
      display_order: display_order !== undefined ?
        parseInt(display_order) :
        existing.display_order
    };

    // اعتبارسنجی فیلدهای اجباری
    if (updateFields.platform && updateFields.platform.length === 0) {
      return res.status(400).json({ error: 'نام پلتفرم نمی‌تواند خالی باشد' });
    }

    if (updateFields.url && updateFields.url.length === 0) {
      return res.status(400).json({ error: 'آدرس URL نمی‌تواند خالی باشد' });
    }

    // بررسی تکراری نبودن نام پلتفرم (UNIQUE constraint)
    if (updateFields.platform && updateFields.platform.toLowerCase() !== existing.platform.toLowerCase()) {
      const duplicate = db.prepare(`
        SELECT id FROM social_links 
        WHERE LOWER(platform) = LOWER(?) AND id != ?
      `).get(updateFields.platform, linkId);

      if (duplicate) {
        return res.status(400).json({ error: 'این نام پلتفرم قبلاً ثبت شده است' });
      }
    }

    // مدیریت آیکون
    let iconUrl = existing.icon;

    // اگر فایل جدید آپلود شده
    if (req.file) {
      console.log('New icon uploaded:', req.file.filename);

      // حذف تصویر قبلی اگر وجود دارد
      if (existing.icon) {
        const oldIconPath = path.join(__dirname, existing.icon.replace('/', ''));
        try {
          if (fs.existsSync(oldIconPath)) {
            fs.unlinkSync(oldIconPath);
            console.log('Old icon deleted:', oldIconPath);
          }
        } catch (err) {
          console.warn('Could not delete old icon:', err.message);
        }
      }
      iconUrl = `/uploads/socials/${req.file.filename}`;
    }

    // اگر کاربر خواست آیکون را حذف کند
    if (remove_icon === 'true' || remove_icon === true) {
      console.log('Removing existing icon');
      if (existing.icon) {
        const oldIconPath = path.join(__dirname, existing.icon.replace('/', ''));
        try {
          if (fs.existsSync(oldIconPath)) {
            fs.unlinkSync(oldIconPath);
            console.log('Icon removed from filesystem');
          }
        } catch (err) {
          console.warn('Could not delete icon:', err.message);
        }
      }
      iconUrl = null;
    }

    // ساختن query به صورت داینامیک
    const updates = [];
    const params = [];

    // اضافه کردن فیلدهای قابل به‌روزرسانی
    if (platform !== undefined) {
      updates.push('platform = ?');
      params.push(updateFields.platform);
    }

    if (url !== undefined) {
      updates.push('url = ?');
      params.push(updateFields.url);
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(updateFields.is_active);
    }

    if (display_order !== undefined) {
      updates.push('display_order = ?');
      params.push(updateFields.display_order);
    }

    // مدیریت آیکون (اگر تغییر کرده)
    if (req.file || remove_icon === 'true' || remove_icon === true) {
      updates.push('icon = ?');
      params.push(iconUrl);
    }

    // اگر هیچ فیلدی برای به‌روزرسانی نیست
    if (updates.length === 0) {
      return res.status(400).json({ error: 'هیچ فیلدی برای به‌روزرسانی ارسال نشده' });
    }

    // اضافه کردن ID به پارامترها
    params.push(linkId);

    // اجرای به‌روزرسانی
    const query = `UPDATE social_links SET ${updates.join(', ')} WHERE id = ?`;
    console.log('Update query:', query);
    console.log('Params:', params);

    const stmt = db.prepare(query);
    const result = stmt.run(...params);

    console.log('Update result:', result);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'هیچ تغییری اعمال نشد' });
    }

    // دریافت لینک به‌روزرسانی شده
    const updatedLink = db.prepare(`
      SELECT * FROM social_links WHERE id = ?
    `).get(linkId);

    console.log('Updated link:', updatedLink);

    res.json({
      success: true,
      message: 'لینک اجتماعی با موفقیت به‌روزرسانی شد',
      data: updatedLink
    });

  } catch (error) {
    console.error('Error updating social link:', error);

    // بررسی خطای UNIQUE constraint
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'این نام پلتفرم قبلاً ثبت شده است' });
    }

    res.status(500).json({
      error: 'خطای سرور در به‌روزرسانی لینک اجتماعی',
      details: error.message
    });
  }
});

// DELETE social link (admin)
app.delete('/api/admin/socials/:id', adminAuth, (req, res) => {
  const { id } = req.params;

  const existing = db.prepare(`
    SELECT * FROM social_links WHERE id=?
  `).get(id);

  if (!existing) {
    return res.status(404).json({ error: 'شبکه اجتماعی پیدا نشد' });
  }

  // حذف تصویر آیکون اگر وجود دارد
  if (existing.icon) {
    const iconPath = existing.icon.replace('/uploads/socials/', 'uploads/socials/');
    if (fs.existsSync(iconPath)) {
      fs.unlinkSync(iconPath);
    }
  }

  db.prepare(`DELETE FROM social_links WHERE id=?`).run(id);

  res.json({
    success: true,
    message: 'شبکه اجتماعی با موفقیت حذف شد'
  });
});
/* ================== INIT DB ================== */
initDatabase();

fillDb();

/* ================== START ================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
