import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

import db from './db.js';
import { adminAuth } from './auth.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

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
app.get('/api/data', (_, res) => {
  const site = db.prepare(`SELECT * FROM site WHERE id=1`).get();
  const images = db.prepare(`SELECT * FROM images`).all();
  res.json({ ...site, images });
});

/* ---------- ADMIN ---------- */
app.get('/api/admin/data', adminAuth, (_, res) => {
  const site = db.prepare(`SELECT * FROM site WHERE id=1`).get();
  const images = db.prepare(`SELECT * FROM images`).all();
  res.json({ ...site, images });
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
