import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initDatabase } from './init-db.js';
import 'dotenv/config';

import db from './db.js';
import { adminAuth } from './auth.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));


// 1. ابتدا این خطا را بالای فایل اضافه کنید
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 2. پیکربندی دقیق multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('Upload request path:', req.path); // برای دیباگ
    console.log('File fieldname:', file.fieldname); // برای دیباگ

    let uploadPath = 'uploads/';

    // تشخیص نوع آپلود بر اساس مسیر
    if (req.path.includes('socials')) {
      uploadPath = 'uploads/socials/';
    } else if (req.path.includes('carousel')) {
      uploadPath = 'uploads/carousel/';
    } else if (req.path.includes('articles')) {
      uploadPath = 'uploads/articles/';
    } else if (req.path.includes('products')) {
      uploadPath = 'uploads/products/';
    } else if (req.path.includes('categories')) {
      uploadPath = 'uploads/categories/';
    }

    console.log('Destination path:', uploadPath); // برای دیباگ

    // ایجاد پوشه اگر وجود ندارد
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log('Created directory:', uploadPath);
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // نام فایل: timestamp-originalname
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    console.log('Generated filename:', uniqueName); // برای دیباگ
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    console.log('File mime type:', file.mimetype); // برای دیباگ

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('فقط فایل‌های تصویری مجاز هستند'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// مقداردهی اولیه دیتابیس
// initDatabase();

// بقیه کدهای سرور...

app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

/* ---------- AUTH ---------- */
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  const admin = db.prepare(`SELECT * FROM admins WHERE email=?`).get(email);

  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: admin.id, email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES }
  );

  res.json({ token });
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

app.post('/api/admin/upload', adminAuth, upload.single('image'), (req, res) => {
  db.prepare(`
    INSERT INTO images (url, title, type, price, off, is_tooman)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    `/uploads/${req.file.filename}`,
    req.body.title || 'تصویر',
    req.body.type,
    req.body.price,
    req.body.off,
    req.body.is_tooman,
  );

  res.json({ success: true });
});

app.delete('/api/admin/image/:id', adminAuth, (req, res) => {
  db.prepare(`DELETE FROM images WHERE id=?`).run(req.params.id);
  res.json({ success: true });
});

app.listen(process.env.PORT, () =>
  console.log(`Server running on ${process.env.PORT}`)
);

/* ---------- ARTICLES ---------- */
// GET all articles (public)
app.get('/api/articles', (_, res) => {
  const articles = db.prepare(`
    SELECT * FROM articles 
    ORDER BY created_at DESC
  `).all();
  res.json(articles);
});

// GET single article (public)
app.get('/api/articles/:id', (req, res) => {
  const article = db.prepare(`
    SELECT * FROM articles WHERE id=?
  `).get(req.params.id);

  if (!article) {
    return res.status(404).json({ error: 'Article not found' });
  }

  res.json(article);
});

// POST create article (admin only)
// POST create article with image upload
app.post('/api/admin/articles', adminAuth, upload.single('image'), (req, res) => {
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  // اگر تصویر آپلود شده باشد
  const imageUrl = req.file
    ? `/uploads/articles/${req.file.filename}`
    : null;

  const result = db.prepare(`
    INSERT INTO articles (title, content, image_url, created_at, updated_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `).run(title, content, imageUrl);

  const newArticle = db.prepare(`
    SELECT * FROM articles WHERE id=?
  `).get(result.lastInsertRowid);

  res.status(201).json(newArticle);
});

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

// GET all articles (admin - with more details if needed)
app.get('/api/admin/articles', adminAuth, (_, res) => {
  const articles = db.prepare(`
    SELECT * FROM articles 
    ORDER BY created_at DESC
  `).all();
  res.json(articles);
});


/* ---------- CATEGORIES ---------- */
// GET all categories (public)
app.get('/api/categories', (_, res) => {
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

// GET single category with products (public)
app.get('/api/categories/:id/products', (req, res) => {
  const category = db.prepare(`
    SELECT * FROM categories WHERE id=?
  `).get(req.params.id);

  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const products = db.prepare(`
    SELECT * FROM products 
    WHERE category_id=? AND is_active=1
    ORDER BY created_at DESC
  `).all(req.params.id);

  res.json({ ...category, products });
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

/* ---------- PRODUCTS ---------- */
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

/* ---------- SOCIAL LINKS ---------- */

// GET all social links (public)
app.get('/api/socials', (_, res) => {
  const links = db.prepare(`
    SELECT * FROM social_links 
    WHERE is_active=1 
    ORDER BY display_order
  `).all();
  res.json(links);
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

    // console.log('@@@@@@@@@@@.  ' + is_active);

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

/* ---------- SITE SETTINGS ---------- */
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

/* ---------- CAROUSEL IMAGES ---------- */
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