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


// مقداردهی اولیه دیتابیس
// initDatabase();

// بقیه کدهای سرور...

app.use(express.urlencoded({ extended: true }));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// multer
const storage = multer.diskStorage({
  destination: 'uploads',
  filename: (_, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

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

/* ---------- PUBLIC ---------- */
// app.get('/api/data', (_, res) => {
//   const site = db.prepare(`SELECT * FROM site WHERE id=1`).get();
//   const images = db.prepare(`SELECT * FROM images`).all();
//   res.json({ ...site, images });
// });

/* ---------- ADMIN ---------- */
// app.get('/api/admin/data', adminAuth, (_, res) => {
//   const site = db.prepare(`SELECT * FROM site WHERE id=1`).get();
//   const images = db.prepare(`SELECT * FROM images`).all();
//   const articles = db.prepare(`SELECT * FROM articles ORDER BY created_at DESC`).all();
//   res.json({ ...site, images, articles });
// });

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
    INSERT INTO images (url, title, type)
    VALUES (?, ?, ?)
  `).run(
    `/uploads/${req.file.filename}`,
    req.body.title || 'تصویر',
    req.body.type
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
    ? `/uploads/${req.file.filename}`
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
    imageUrl = `/uploads/${req.file.filename}`;
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
    const imagePath = existing.image_url.replace('/uploads/', 'uploads/');
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

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

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
    imageUrl = `/uploads/${req.file.filename}`;
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
    const imagePath = category.image_url.replace('/uploads/', 'uploads/');
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

  const imageUrl = `/uploads/${req.file.filename}`;

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
    imageUrl = `/uploads/${req.file.filename}`;
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

// DELETE product (admin)
// app.delete('/api/admin/products/:id', adminAuth, (req, res) => {
//   const product = db.prepare(`SELECT * FROM products WHERE id=?`).get(req.params.id);

//   if (!product) {
//     return res.status(404).json({ error: 'Product not found' });
//   }

//   // حذف تصویر محصول
//   if (product.image_url) {
//     const imagePath = product.image_url.replace('/uploads/', 'uploads/');
//     if (fs.existsSync(imagePath)) {
//       fs.unlinkSync(imagePath);
//     }
//   }

//   db.prepare(`DELETE FROM products WHERE id=?`).run(req.params.id);
//   res.json({ success: true });
// });

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
    const imagePath = existing.image_url.replace('/uploads/', 'uploads/');
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
// // GET social links (public)
// app.get('/api/social-links', (_, res) => {
//   const links = db.prepare(`
//     SELECT * FROM social_links 
//     WHERE is_active=1 
//     ORDER BY display_order
//   `).all();
//   res.json(links);
// });

// // GET all social links (admin)
// app.get('/api/admin/social-links', adminAuth, (_, res) => {
//   const links = db.prepare(`
//     SELECT * FROM social_links 
//     ORDER BY display_order
//   `).all();
//   res.json(links);
// });

// // UPDATE social link (admin)
// app.put('/api/admin/social-links/:id', adminAuth, (req, res) => {
//   const { url, is_active, display_order } = req.body;

//   db.prepare(`
//     UPDATE social_links 
//     SET url = COALESCE(?, url),
//         is_active = COALESCE(?, is_active),
//         display_order = COALESCE(?, display_order)
//     WHERE id=?
//   `).run(url, is_active, display_order, req.params.id);

//   const updated = db.prepare(`SELECT * FROM social_links WHERE id=?`).get(req.params.id);
//   res.json(updated);
// });

/* ---------- SOCIAL LINKS ---------- */

// GET all social links (public)
app.get('/api/social-links', (_, res) => {
  const links = db.prepare(`
    SELECT * FROM social_links 
    WHERE is_active=1 
    ORDER BY display_order
  `).all();
  res.json(links);
});

// GET all social links (admin - با همه اطلاعات)
app.get('/api/admin/social-links', adminAuth, (_, res) => {
  const links = db.prepare(`
    SELECT * FROM social_links 
    ORDER BY display_order
  `).all();
  res.json(links);
});

// CREATE new social link (admin)
app.post('/api/admin/social-links', adminAuth, (req, res) => {
  const { platform, url, icon, display_order } = req.body;

  if (!platform || !url) {
    return res.status(400).json({ error: 'Platform and URL are required' });
  }

  // بررسی اینکه آیا پلتفرم از قبل وجود دارد
  const existing = db.prepare(`
    SELECT id FROM social_links WHERE platform=?
  `).get(platform);

  if (existing) {
    return res.status(400).json({ error: 'Platform already exists' });
  }

  const result = db.prepare(`
    INSERT INTO social_links (platform, url, icon, display_order, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run(platform, url, icon || platform, display_order || 99);

  const newLink = db.prepare(`
    SELECT * FROM social_links WHERE id=?
  `).get(result.lastInsertRowid);

  res.status(201).json(newLink);
});

// UPDATE social link (admin)
app.put('/api/admin/social-links/:id', adminAuth, (req, res) => {
  const { url, icon, is_active, display_order } = req.body;

  const existing = db.prepare(`
    SELECT * FROM social_links WHERE id=?
  `).get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Social link not found' });
  }

  db.prepare(`
    UPDATE social_links 
    SET url = COALESCE(?, url),
        icon = COALESCE(?, icon),
        is_active = COALESCE(?, is_active),
        display_order = COALESCE(?, display_order)
    WHERE id=?
  `).run(url, icon, is_active, display_order, req.params.id);

  const updated = db.prepare(`SELECT * FROM social_links WHERE id=?`).get(req.params.id);
  res.json(updated);
});

// DELETE social link (admin)
app.delete('/api/admin/social-links/:id', adminAuth, (req, res) => {
  const { id } = req.params;

  const existing = db.prepare(`
    SELECT * FROM social_links WHERE id=?
  `).get(id);

  if (!existing) {
    return res.status(404).json({ error: 'Social link not found' });
  }

  // بررسی اینکه آیا می‌توان حذف کرد (اگر از پلتفرم‌های پیش‌فرض باشد، می‌توان غیرفعال کرد ولی حذف نکرد)
  const isDefault = ['telegram', 'instagram', 'pinterest', 'aparat', 'youtube', 'whatsapp']
    .includes(existing.platform);

  if (isDefault) {
    // برای پلتفرم‌های پیش‌فرض، فقط غیرفعال می‌کنیم
    db.prepare(`
      UPDATE social_links 
      SET is_active = 0 
      WHERE id=?
    `).run(id);

    res.json({
      success: true,
      message: 'Default social link deactivated (not deleted)',
      deactivated: true
    });
  } else {
    // برای پلتفرم‌های دلخواه، حذف می‌کنیم
    db.prepare(`DELETE FROM social_links WHERE id=?`).run(id);
    res.json({
      success: true,
      message: 'Social link deleted successfully',
      deleted: true
    });
  }
});

// BULK UPDATE social links order (admin)
app.put('/api/admin/social-links/order', adminAuth, (req, res) => {
  const { order } = req.body; // آرایه‌ای از {id, display_order}

  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'Order array is required' });
  }

  const updateStmt = db.prepare(`
    UPDATE social_links 
    SET display_order = ? 
    WHERE id = ?
  `);

  const transaction = db.transaction((items) => {
    for (const item of items) {
      updateStmt.run(item.display_order, item.id);
    }
  });

  try {
    transaction(order);
    res.json({ success: true, message: 'Order updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order' });
  }
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
    INSERT INTO images (url, title, type)
    VALUES (?, ?, 'carousel')
  `).run(`/uploads/${req.file.filename}`, req.body.title || 'Carousel Image');

  res.json({ success: true });
});

// حذف تصویر carousel
app.delete('/api/admin/carousel/:id', adminAuth, (req, res) => {
  const image = db.prepare(`SELECT * FROM images WHERE id=? AND type='carousel'`).get(req.params.id);

  if (!image) {
    return res.status(404).json({ error: 'Carousel image not found' });
  }

  // حذف فایل
  const imagePath = image.url.replace('/uploads/', 'uploads/');
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
    SELECT * FROM social_links WHERE is_active=1 ORDER BY display_order
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


  console.log(`${JSON.stringify(carouselImages)}`)

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