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
const UPLOAD_ROOT = '/data/uploads';
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
