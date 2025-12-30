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

// GET all social links (admin - با همه اطلاعات)
app.get('/api/admin/socials', adminAuth, (_, res) => {
  const links = db.prepare(`
    SELECT * FROM social_links 
    ORDER BY display_order
  `).all();
  res.json(links);
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

app.post(
  '/api/admin/articles',
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

/* ================== PRODUCTS ================== */
app.post(
  '/api/admin/products',
  adminAuth,
  upload.single('image'),
  (req, res) => {
    const imageUrl = `/uploads/products/${req.file.filename}`;

    const r = db.prepare(`
      INSERT INTO products
      (category_id,title,image_url,price,discount_percent,description,features)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      req.body.category_id,
      req.body.title,
      imageUrl,
      req.body.price,
      req.body.discount_percent || 0,
      req.body.description,
      req.body.features
    );

    res.status(201).json(
      db.prepare(`SELECT * FROM products WHERE id=?`).get(r.lastInsertRowid)
    );
  }
);

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

/* ================== INIT DB ================== */
initDatabase();

fillDb();

/* ================== START ================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
