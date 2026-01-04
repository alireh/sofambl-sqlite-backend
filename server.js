/* ================== ENV ================== */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '.env');
console.log('🔍 مسیر .env:', envPath);
dotenv.config({ path: envPath });

console.log('✅ DB_PASSWORD loaded:', process.env.DB_PASSWORD ? 'YES' : 'NO');

/* ================== CORE ================== */
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';

/* ================== LOCAL ================== */
import db from './db.js';
import { initDatabase } from './init-db.js';
import { adminAuth } from './auth.js';
import { fillDb } from './fill-db.js';

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

/* ================== ADMIN DATA ================== */
app.get('/api/admin/data', adminAuth, async (_, res) => {
    try {
        const site = await db.get('SELECT * FROM site WHERE id = ?', [1]);
        const images = await db.all('SELECT * FROM images WHERE type != ?', ['carousel']);
        const carouselImages = await db.all('SELECT * FROM images WHERE type = ?', ['carousel']);
        const articles = await db.all('SELECT * FROM articles ORDER BY created_at DESC');
        const categories = await db.all('SELECT * FROM categories ORDER BY created_at DESC');
        const products = await db.all('SELECT * FROM products ORDER BY created_at DESC');
        const socialLinks = await db.all('SELECT * FROM social_links ORDER BY display_order');
        const settings = await db.get('SELECT * FROM site_settings WHERE id = ?', [1]);

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
    } catch (error) {
        console.error('Error in /api/admin/data:', error);
        res.status(500).json({ error: error.message });
    }
});


/* ================== PUBLIC DATA ================== */
app.get("/api/data", async (_, res) => {
    console.log('🚀 شروع /api/data');

    try {
        // 1. ابتدا جداگانه هر کوئری را تست می‌کنیم
        console.log('🔍 مرحله 1: دریافت اطلاعات سایت');
        let site;
        try {
            const [siteResult] = await db.all('SELECT * FROM site WHERE id = ?', [1]);
            site = siteResult[0];
            console.log('✅ اطلاعات سایت:', site ? 'موفق' : 'سایت یافت نشد');
        } catch (siteError) {
            console.error('❌ خطا در دریافت سایت:', siteError.message);
            site = null;
        }

        // 2. تصاویر غیرکاروسل
        console.log('🔍 مرحله 2: دریافت تصاویر غیرکاروسل');
        let images = [];
        try {
            const [imagesResult] = await db.all('SELECT * FROM images WHERE type != ?', ['carousel']);
            images = imagesResult;
            console.log(`✅ ${images.length} تصویر غیرکاروسل دریافت شد`);
        } catch (imagesError) {
            console.error('❌ خطا در دریافت تصاویر:', imagesError.message);
        }

        // 3. تنظیمات سایت
        console.log('🔍 مرحله 3: دریافت تنظیمات سایت');
        let settings;
        let maxCarouselItems = 5;
        try {
            const [settingsResult] = await db.all('SELECT * FROM site_settings WHERE id = ?', [1]);
            settings = settingsResult[0];

            if (settings && settings.max_carousel_items) {
                maxCarouselItems = parseInt(settings.max_carousel_items);
                if (isNaN(maxCarouselItems) || maxCarouselItems <= 0) {
                    maxCarouselItems = 5;
                }
            }
            console.log('✅ تنظیمات:', settings ? 'موفق' : 'تنظیمات یافت نشد');
            console.log(`🔢 حداکثر کاروسل: ${maxCarouselItems}`);
        } catch (settingsError) {
            console.error('❌ خطا در دریافت تنظیمات:', settingsError.message);
            settings = { max_carousel_items: 5 };
        }

        // 4. تصاویر کاروسل
        console.log('🔍 مرحله 4: دریافت تصاویر کاروسل');
        let carouselImages = [];
        try {
            console.log(`📝 اجرای کوئری: SELECT * FROM images WHERE type = 'carousel' ORDER BY id DESC LIMIT ${maxCarouselItems}`);
            const [carouselResult] = await db.all(
                'SELECT * FROM images WHERE type = ? ORDER BY id DESC LIMIT ?',
                ['carousel', maxCarouselItems]
            );
            carouselImages = carouselResult;
            console.log(`✅ ${carouselImages.length} تصویر کاروسل دریافت شد`);
        } catch (carouselError) {
            console.error('❌ خطا در دریافت تصاویر کاروسل:', carouselError.message);
            console.error('کوئری:', 'SELECT * FROM images WHERE type = ? ORDER BY id DESC LIMIT ?');
            console.error('پارامترها:', ['carousel', maxCarouselItems]);
        }

        // 5. لینک‌های اجتماعی - اینجا احتمالاً مشکل است
        console.log('🔍 مرحله 5: دریافت لینک‌های اجتماعی');
        let socialLinks = [];
        try {
            // اول ببینیم جدول وجود دارد
            const [tables] = await db.all("SHOW TABLES LIKE 'social_links'");
            if (tables.length === 0) {
                console.log('⚠️ جدول social_links وجود ندارد');
            } else {
                // ساختار جدول را بررسی کنیم
                const [columns] = await db.all("DESCRIBE social_links");
                console.log('📋 ستون‌های social_links:');
                columns.forEach(col => {
                    console.log(`  - ${col.Field} (${col.Type})`);
                });

                // ابتدا بدون شرط تست می‌کنیم
                const [allSocial] = await db.all('SELECT * FROM social_links');
                console.log(`📊 کل رکوردهای social_links: ${allSocial.length}`);

                // حالا با شرط
                console.log('📝 تست کوئری با شرط is_active...');

                // راه حل 1: استفاده از 1 به جای true
                const [socialResult] = await db.all(
                    'SELECT * FROM social_links WHERE is_active = ? ORDER BY display_order',
                    [1] // این مهم است - در MySQL از 1 استفاده کنید
                );
                socialLinks = socialResult;
                console.log(`✅ ${socialLinks.length} لینک اجتماعی فعال دریافت شد`);
            }
        } catch (socialError) {
            console.error('❌ خطا در دریافت لینک‌های اجتماعی:', socialError.message);
            console.error('کد خطا:', socialError.code);
            console.error('کوئری مشکل‌دار:', 'SELECT * FROM social_links WHERE is_active = ? ORDER BY display_order');

            // راه حل جایگزین: بدون پارامتر
            try {
                console.log('🔄 تلاش با کوئری بدون پارامتر...');
                const [alternativeResult] = await db.all(
                    "SELECT * FROM social_links WHERE is_active = 1 ORDER BY display_order"
                );
                socialLinks = alternativeResult;
                console.log(`✅ (جایگزین) ${socialLinks.length} لینک اجتماعی دریافت شد`);
            } catch (altError) {
                console.error('❌ خطا در روش جایگزین:', altError.message);
            }
        }

        // 6. آماده‌سازی و ارسال پاسخ
        console.log('🔍 مرحله 6: آماده‌سازی پاسخ');
        const response = {
            site: site || {},
            images: images || [],
            carouselImages: carouselImages || [],
            settings: settings || { max_carousel_items: 5 },
            socialLinks: socialLinks || []
        };

        console.log('✅ پاسخ آماده شد:', {
            site: response.site ? 'دارد' : 'ندارد',
            imagesCount: response.images.length,
            carouselCount: response.carouselImages.length,
            socialLinksCount: response.socialLinks.length
        });

        res.json(response);

    } catch (error) {
        console.error('💥 خطای کلی در /api/data:', error.message);
        console.error('Stack trace:', error.stack);

        // اطلاعات بیشتر برای دیباگ
        console.error('📌 اطلاعات خطا:', {
            code: error.code,
            errno: error.errno,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage
        });

        res.status(500).json({
            success: false,
            error: 'خطا در دریافت داده‌ها',
            details: error.message,
            code: error.code
        });
    }
});

/* ================== UPDATE CONTENT ================== */
app.put('/api/admin/update-content', adminAuth, async (req, res) => {
    try {
        const { about, address, email, phone } = req.body;

        await db.run(
            `UPDATE site SET
                about = COALESCE(?, about),
                address = COALESCE(?, address),
                email = COALESCE(?, email),
                phone = COALESCE(?, phone),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [about, address, email, phone, 1]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error in /api/admin/update-content:', error);
        res.status(500).json({ error: error.message });
    }
});

/* ================== CONTACT MESSAGES ================== */
// POST: ارسال پیام تماس جدید
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: 'نام الزامی است' });
        }

        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, error: 'ایمیل الزامی است' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            return res.status(400).json({ success: false, error: 'فرمت ایمیل نامعتبر است' });
        }

        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, error: 'متن پیام الزامی است' });
        }

        const [recentMessages] = await db.all(
            `SELECT COUNT(*) as count FROM contact_messages WHERE email = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
            [email.trim()]
        );

        if (recentMessages[0].count >= 5) {
            return res.status(429).json({
                success: false,
                error: 'تعداد پیام‌های شما در یک ساعت گذشته زیاد بوده است. لطفاً کمی صبر کنید.'
            });
        }

        const result = await db.run(
            `INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)`,
            [name.trim(), email.trim(), message.trim()]
        );

        const savedMessage = await db.get(
            `SELECT * FROM contact_messages WHERE id = ?`,
            [result.lastID]
        );

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

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: 'این ایمیل قبلاً ثبت شده است' });
        }

        res.status(500).json({ success: false, error: 'خطا در ثبت پیام. لطفاً مجدداً تلاش کنید' });
    }
});

// GET: دریافت تمام پیام‌ها (ادمین)
app.get('/api/admin/contact-messages', adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', read = '', sort = 'newest' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereConditions = [];
        let params = [];

        if (search) {
            whereConditions.push('(name LIKE ? OR email LIKE ? OR message LIKE ?)');
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (read === 'read') {
            whereConditions.push('is_read = ?');
            params.push(1);
        } else if (read === 'unread') {
            whereConditions.push('is_read = ?');
            params.push(0);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        let orderBy = 'created_at DESC';
        if (sort === 'oldest') orderBy = 'created_at ASC';
        else if (sort === 'name') orderBy = 'name ASC';
        else if (sort === 'email') orderBy = 'email ASC';

        const messages = await db.all(
            `SELECT * FROM contact_messages ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );

        const totalResult = await db.get(
            `SELECT COUNT(*) as total FROM contact_messages ${whereClause}`,
            params
        );

        const stats = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today
            FROM contact_messages
        `);

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
        res.status(500).json({ success: false, error: 'خطا در دریافت پیام‌ها' });
    }
});

// GET: دریافت یک پیام خاص
app.get('/api/admin/contact-messages/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const message = await db.get('SELECT * FROM contact_messages WHERE id = ?', [id]);

        if (!message) {
            return res.status(404).json({ success: false, error: 'پیام پیدا نشد' });
        }

        res.json({ success: true, data: message });
    } catch (error) {
        console.error('خطا در دریافت پیام:', error);
        res.status(500).json({ success: false, error: 'خطا در دریافت پیام' });
    }
});

// PUT: علامت‌گذاری پیام به عنوان خوانده شده
app.put('/api/admin/contact-messages/:id/read', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await db.get('SELECT * FROM contact_messages WHERE id = ?', [id]);

        if (!existing) {
            return res.status(404).json({ success: false, error: 'پیام پیدا نشد' });
        }

        await db.run('UPDATE contact_messages SET is_read = ? WHERE id = ?', [1, id]);

        res.json({ success: true, message: 'پیام به عنوان خوانده شده علامت‌گذاری شد' });
    } catch (error) {
        console.error('خطا در به‌روزرسانی پیام:', error);
        res.status(500).json({ success: false, error: 'خطا در به‌روزرسانی پیام' });
    }
});

// PUT: به‌روزرسانی وضعیت خوانده/نخوانده
app.put('/api/admin/contact-messages/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_read } = req.body;
        const existing = await db.get('SELECT * FROM contact_messages WHERE id = ?', [id]);

        if (!existing) {
            return res.status(404).json({ success: false, error: 'پیام پیدا نشد' });
        }

        await db.run('UPDATE contact_messages SET is_read = ? WHERE id = ?', [is_read ? 1 : 0, id]);

        res.json({
            success: true,
            message: `پیام با موفقیت ${is_read ? 'خوانده' : 'نخوانده'} شد`
        });
    } catch (error) {
        console.error('خطا در به‌روزرسانی پیام:', error);
        res.status(500).json({ success: false, error: 'خطا در به‌روزرسانی پیام' });
    }
});

// DELETE: حذف یک پیام
app.delete('/api/admin/contact-messages/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await db.get('SELECT * FROM contact_messages WHERE id = ?', [id]);

        if (!existing) {
            return res.status(404).json({ success: false, error: 'پیام پیدا نشد' });
        }

        await db.run('DELETE FROM contact_messages WHERE id = ?', [id]);

        console.log('پیام حذف شد:', { id, name: existing.name, email: existing.email });

        res.json({ success: true, message: 'پیام با موفقیت حذف شد' });
    } catch (error) {
        console.error('خطا در حذف پیام:', error);
        res.status(500).json({ success: false, error: 'خطا در حذف پیام' });
    }
});

// DELETE: حذف چندین پیام
app.delete('/api/admin/contact-messages', adminAuth, async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: 'لیست شناسه‌های پیام‌ها الزامی است' });
        }

        const placeholders = ids.map(() => '?').join(',');
        const result = await db.run(
            `DELETE FROM contact_messages WHERE id IN (${placeholders})`,
            ids
        );

        console.log(`${result.changes} پیام حذف شد`);

        res.json({
            success: true,
            message: `${result.changes} پیام با موفقیت حذف شدند`
        });
    } catch (error) {
        console.error('خطا در حذف پیام‌ها:', error);
        res.status(500).json({ success: false, error: 'خطا در حذف پیام‌ها' });
    }
});

// GET: دریافت آمار پیام‌ها
app.get('/api/admin/contact-stats', adminAuth, async (req, res) => {
    try {
        const overallStats = await db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today
            FROM contact_messages
        `);

        const weeklyStats = await db.all(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM contact_messages
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `);

        res.json({
            success: true,
            data: {
                overall: overallStats,
                weekly: weeklyStats
            }
        });
    } catch (error) {
        console.error('خطا در دریافت آمار:', error);
        res.status(500).json({ success: false, error: 'خطا در دریافت آمار' });
    }
});

/* ================== SITE SETTINGS ================== */
app.get('/api/site-settings', async (_, res) => {
    try {
        const settings = await db.get('SELECT * FROM site_settings WHERE id = ?', [1]);
        const carouselImages = await db.all(
            'SELECT * FROM images WHERE type = ? ORDER BY id DESC LIMIT ?',
            ['carousel', settings?.max_carousel_items || 5]
        );
        const images = await db.all(
            'SELECT * FROM images WHERE type != ? ORDER BY id DESC LIMIT ?',
            ['carousel', settings?.max_carousel_items || 5]
        );

        res.json({ ...settings, carouselImages, images });
    } catch (error) {
        console.error('Error in /api/site-settings:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/site-settings', adminAuth, async (req, res) => {
    try {
        const { max_carousel_items, article_display_mode } = req.body;
        const show_carousel = req.body.show_carousel ? 1 : 0;

        await db.run(
            `UPDATE site_settings 
            SET show_carousel = COALESCE(?, show_carousel),
                max_carousel_items = COALESCE(?, max_carousel_items),
                article_display_mode = COALESCE(?, article_display_mode),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [show_carousel, max_carousel_items, article_display_mode, 1]
        );

        const updated = await db.get('SELECT * FROM site_settings WHERE id = ?', [1]);
        res.json(updated);
    } catch (error) {
        console.error('Error in /api/admin/site-settings:', error);
        res.status(500).json({ error: error.message });
    }
});

/* ================== IMAGE MANAGEMENT ================== */
app.delete('/api/admin/image/:id', adminAuth, async (req, res) => {
    try {
        const imageId = req.params.id;
        const existing = await db.get('SELECT * FROM images WHERE id = ?', [imageId]);

        if (existing && existing.url) {
            const imagePath = existing.url.replace('/uploads/', 'uploads/');
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await db.run('DELETE FROM images WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error in /api/admin/image/:id:', error);
        res.status(500).json({ error: error.message });
    }
});

/* ================== HEALTH ================== */
app.get('/', (_, res) => res.send('API is running'));
app.get('/health', (_, res) => res.json({ status: 'ok' }));

/* ================== AUTH ================== */
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await db.get('SELECT * FROM admins WHERE email = ?', [email]);

        if (!admin || !bcrypt.compareSync(password, admin.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: admin.id, email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES || '1d' }
        );

        res.json({ token });
    } catch (error) {
        console.error('Error in /api/admin/login:', error);
        res.status(500).json({ error: error.message });
    }
});

/* ================== UPLOAD IMAGE ================== */
app.post('/api/admin/upload', adminAuth, upload.single('image'), async (req, res) => {
    try {
        await db.run(
            `INSERT INTO images (url, title, type, price, off, is_tooman)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                `/uploads/${req.file.filename}`,
                req.body.title || 'image',
                req.body.type,
                req.body.price || 0,
                req.body.off || 0,
                req.body.is_tooman ? 1 : 0
            ]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error in /api/admin/upload:', error);
        res.status(500).json({ error: error.message });
    }
});

/* ================== ARTICLES ================== */
app.get('/api/articles', async (_, res) => {
    try {
        const articles = await db.all('SELECT * FROM articles ORDER BY created_at DESC');
        res.json(articles);
    } catch (error) {
        console.error('Error in /api/articles:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/articles', adminAuth, async (_, res) => {
    try {
        const articles = await db.all('SELECT * FROM articles ORDER BY created_at DESC');
        res.json(articles);
    } catch (error) {
        console.error('Error in /api/admin/articles:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/articles', adminAuth, upload.single('image'), async (req, res) => {
    try {
        const imageUrl = req.file ? `/uploads/articles/${req.file.filename}` : null;
        const result = await db.run(
            `INSERT INTO articles (title, content, image_url, created_at, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [req.body.title, req.body.content, imageUrl]
        );

        const newArticle = await db.get('SELECT * FROM articles WHERE id = ?', [result.lastID]);
        res.status(201).json(newArticle);
    } catch (error) {
        console.error('Error in /api/admin/articles POST:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/articles/:id', adminAuth, upload.single('image'), async (req, res) => {
    try {
        const { title, content, removeImage } = req.body;
        const articleId = req.params.id;

        const existing = await db.get('SELECT * FROM articles WHERE id = ?', [articleId]);
        if (!existing) {
            return res.status(404).json({ error: 'Article not found' });
        }

        let imageUrl = existing.image_url;
        if (req.file) {
            imageUrl = `/uploads/articles/${req.file.filename}`;
        }
        if (removeImage === 'true') {
            imageUrl = null;
        }

        await db.run(
            `UPDATE articles 
            SET title = COALESCE(?, title),
                content = COALESCE(?, content),
                image_url = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [title, content, imageUrl, articleId]
        );

        const updatedArticle = await db.get('SELECT * FROM articles WHERE id = ?', [articleId]);
        res.json(updatedArticle);
    } catch (error) {
        console.error('Error in /api/admin/articles PUT:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/articles/:id', adminAuth, async (req, res) => {
    try {
        const articleId = req.params.id;
        const existing = await db.get('SELECT * FROM articles WHERE id = ?', [articleId]);

        if (!existing) {
            return res.status(404).json({ error: 'Article not found' });
        }

        if (existing.image_url) {
            const imagePath = existing.image_url.replace('/uploads/articles/', 'uploads/articles/');
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await db.run('DELETE FROM articles WHERE id = ?', [articleId]);
        res.json({ success: true, message: 'Article deleted successfully' });
    } catch (error) {
        console.error('Error in /api/admin/articles DELETE:', error);
        res.status(500).json({ error: error.message });
    }
});

/* ================== CATEGORIES ================== */
app.get("/api/categories", async (_, res) => {
    try {
        const categories = await db.all(`
            SELECT c.*, COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `);
        res.json(categories);
    } catch (error) {
        console.error('Error in /api/categories:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/categories', adminAuth, async (_, res) => {
    try {
        const categories = await db.all(`
            SELECT c.*, 
                COUNT(p.id) as product_count,
                SUM(CASE WHEN p.is_active = 1 THEN 1 ELSE 0 END) as active_products
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `);
        res.json(categories);
    } catch (error) {
        console.error('Error in /api/admin/categories:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/categories', adminAuth, upload.single('image'), async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const imageUrl = req.file ? `/uploads/categories/${req.file.filename}` : null;
        const result = await db.run(
            'INSERT INTO categories (title, image_url, description) VALUES (?, ?, ?)',
            [title, imageUrl, description]
        );

        const newCategory = await db.get('SELECT * FROM categories WHERE id = ?', [result.lastID]);
        res.status(201).json(newCategory);
    } catch (error) {
        console.error('Error in /api/admin/categories POST:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/categories/:id', adminAuth, upload.single('image'), async (req, res) => {
    try {
        const { title, description, removeImage } = req.body;
        const existing = await db.get('SELECT * FROM categories WHERE id = ?', [req.params.id]);

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

        await db.run(
            `UPDATE categories 
            SET title = COALESCE(?, title),
                description = COALESCE(?, description),
                image_url = ?
            WHERE id = ?`,
            [title, description, imageUrl, req.params.id]
        );

        const updated = await db.get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        console.error('Error in /api/admin/categories PUT:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/categories/:id', adminAuth, async (req, res) => {
    try {
        const hasProducts = await db.get(
            'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
            [req.params.id]
        );

        if (hasProducts.count > 0) {
            return res.status(400).json({
                error: 'Cannot delete category with products. Delete products first.'
            });
        }

        const category = await db.get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
        if (category && category.image_url) {
            const imagePath = category.image_url.replace('/uploads/categories/', 'uploads/categories/');
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await db.run('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error in /api/admin/categories DELETE:', error);
        res.status(500).json({ error: error.message });
    }
});

/* ================== PRODUCTS ================== */
app.get('/api/products', async (_, res) => {
    try {
        const products = await db.all(`
            SELECT p.*, c.title as category_title
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1
            ORDER BY p.created_at DESC
        `);
        res.json(products);
    } catch (error) {
        console.error('Error in /api/products:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/categories/:id/products', async (req, res) => {
    try {
        const category = await db.get('SELECT * FROM categories WHERE id = ?', [req.params.id]);

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const products = await db.all(
            'SELECT * FROM products WHERE category_id = ? ORDER BY created_at DESC',
            [req.params.id]
        );

        res.json({ ...category, products });
    } catch (error) {
        console.error('Error in /api/categories/:id/products:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/products', adminAuth, async (_, res) => {
    try {
        const products = await db.all(`
            SELECT p.*, c.title as category_title
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY p.created_at DESC
        `);
        res.json(products);
    } catch (error) {
        console.error('Error in /api/admin/products:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/products', adminAuth, upload.single('image'), async (req, res) => {
    try {
        const { category_id, title, price, discount_percent, description, features } = req.body;

        if (!category_id || !title || !price || !req.file) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const imageUrl = `/uploads/products/${req.file.filename}`;
        const result = await db.run(
            `INSERT INTO products (category_id, title, image_url, price, discount_percent, description, features)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [category_id, title, imageUrl, price, discount_percent || 0, description, features]
        );

        const newProduct = await db.get('SELECT * FROM products WHERE id = ?', [result.lastID]);
        res.status(201).json(newProduct);
    } catch (error) {
        console.error('Error in /api/admin/products POST:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/products/:id', adminAuth, upload.single('image'), async (req, res) => {
    try {
        const { category_id, title, price, discount_percent, description, features, removeImage } = req.body;
        const existing = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);

        if (!existing) {
            return res.status(404).json({ error: 'Product not found' });
        }

        let imageUrl = existing.image_url;
        if (req.file) {
            imageUrl = `/uploads/products/${req.file.filename}`;
        }
        if (removeImage === 'true') {
            imageUrl = existing.image_url;
        }

        await db.run(
            `UPDATE products 
            SET category_id = COALESCE(?, category_id),
                title = COALESCE(?, title),
                price = COALESCE(?, price),
                discount_percent = COALESCE(?, discount_percent),
                description = COALESCE(?, description),
                features = COALESCE(?, features),
                image_url = COALESCE(?, image_url)
            WHERE id = ?`,
            [category_id, title, price, discount_percent, description, features, imageUrl, req.params.id]
        );

        const updated = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        console.error('Error in /api/admin/products PUT:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/products/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await db.get('SELECT * FROM products WHERE id = ?', [id]);

        if (!existing) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (existing.image_url) {
            const imagePath = existing.image_url.replace('/uploads/products/', 'uploads/products/');
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await db.run('DELETE FROM products WHERE id = ?', [id]);
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error in /api/admin/products DELETE:', error);
        res.status(500).json({ error: error.message });
    }
});

/* ================== CAROUSEL ================== */
app.post('/api/admin/carousel', adminAuth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Image is required' });
        }

        const settings = await db.get('SELECT max_carousel_items FROM site_settings WHERE id = ?', [1]);
        const currentCount = await db.get('SELECT COUNT(*) as count FROM images WHERE type = ?', ['carousel']);

        if (currentCount.count >= (settings?.max_carousel_items || 5)) {
            return res.status(400).json({
                error: `Maximum ${settings?.max_carousel_items || 5} carousel images allowed`
            });
        }

        await db.run(
            `INSERT INTO images (url, title, type, price, off, is_tooman)
            VALUES (?, ?, 'carousel', 0, 0, 1)`,
            [`/uploads/carousel/${req.file.filename}`, req.body.title || 'Carousel Image']
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error in /api/admin/carousel:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/carousel/:id', adminAuth, async (req, res) => {
    try {
        const image = await db.get(
            'SELECT * FROM images WHERE id = ? AND type = ?',
            [req.params.id, 'carousel']
        );

        if (!image) {
            return res.status(404).json({ error: 'Carousel image not found' });
        }

        const imagePath = image.url.replace('/uploads/carousel/', 'uploads/carousel/');
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        await db.run('DELETE FROM images WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error in /api/admin/carousel DELETE:', error);
        res.status(500).json({ error: error.message });
    }
});

/* ================== SOCIALS ================== */
app.get('/api/socials', async (_, res) => {
    try {
        const links = await db.all(
            'SELECT * FROM social_links WHERE is_active = ? ORDER BY display_order',
            [1]
        );
        res.json(links);
    } catch (error) {
        console.error('Error in /api/socials:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/socials', adminAuth, async (_, res) => {
    try {
        const links = await db.all('SELECT * FROM social_links ORDER BY display_order');
        res.json(links);
    } catch (error) {
        console.error('Error in /api/admin/socials:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/socials', adminAuth, upload.single('icon'), async (req, res) => {
    try {
        const { platform, url, display_order } = req.body;

        if (!platform || !platform.trim()) {
            return res.status(400).json({ error: 'نام پلتفرم الزامی است' });
        }

        if (!url || !url.trim()) {
            return res.status(400).json({ error: 'آدرس URL الزامی است' });
        }

        const existing = await db.get(
            'SELECT id FROM social_links WHERE LOWER(platform) = LOWER(?)',
            [platform.trim()]
        );

        if (existing) {
            return res.status(400).json({ error: 'این نام پلتفرم قبلاً ثبت شده است' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'تصویر آیکون الزامی است' });
        }

        const iconUrl = `/uploads/socials/${req.file.filename}`;
        const result = await db.run(
            `INSERT INTO social_links (platform, url, icon, display_order, is_active)
            VALUES (?, ?, ?, ?, ?)`,
            [platform.trim(), url.trim(), iconUrl, display_order || 0, 1]
        );

        const newLink = await db.get('SELECT * FROM social_links WHERE id = ?', [result.lastID]);
        res.status(201).json(newLink);
    } catch (error) {
        console.error('Error in social link creation:', error);
        res.status(500).json({ error: 'خطای سرور' });
    }
});

app.put('/api/admin/socials/:id', adminAuth, upload.single('icon'), async (req, res) => {
    try {
        const { platform, url, is_active, display_order, remove_icon } = req.body;
        const linkId = req.params.id;

        if (!linkId || isNaN(parseInt(linkId))) {
            return res.status(400).json({ error: 'شناسه معتبر الزامی است' });
        }

        const existing = await db.get('SELECT * FROM social_links WHERE id = ?', [linkId]);
        if (!existing) {
            return res.status(404).json({ error: 'شبکه اجتماعی پیدا نشد' });
        }

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

        if (updateFields.platform && updateFields.platform.length === 0) {
            return res.status(400).json({ error: 'نام پلتفرم نمی‌تواند خالی باشد' });
        }

        if (updateFields.url && updateFields.url.length === 0) {
            return res.status(400).json({ error: 'آدرس URL نمی‌تواند خالی باشد' });
        }

        if (updateFields.platform && updateFields.platform.toLowerCase() !== existing.platform.toLowerCase()) {
            const duplicate = await db.get(
                'SELECT id FROM social_links WHERE LOWER(platform) = LOWER(?) AND id != ?',
                [updateFields.platform, linkId]
            );

            if (duplicate) {
                return res.status(400).json({ error: 'این نام پلتفرم قبلاً ثبت شده است' });
            }
        }

        let iconUrl = existing.icon;

        if (req.file) {
            if (existing.icon) {
                const oldIconPath = path.join(__dirname, existing.icon.replace('/', ''));
                try {
                    if (fs.existsSync(oldIconPath)) {
                        fs.unlinkSync(oldIconPath);
                    }
                } catch (err) {
                    console.warn('Could not delete old icon:', err.message);
                }
            }
            iconUrl = `/uploads/socials/${req.file.filename}`;
        }

        if (remove_icon === 'true' || remove_icon === true) {
            if (existing.icon) {
                const oldIconPath = path.join(__dirname, existing.icon.replace('/', ''));
                try {
                    if (fs.existsSync(oldIconPath)) {
                        fs.unlinkSync(oldIconPath);
                    }
                } catch (err) {
                    console.warn('Could not delete icon:', err.message);
                }
            }
            iconUrl = null;
        }

        const updates = [];
        const params = [];

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

        if (req.file || remove_icon === 'true' || remove_icon === true) {
            updates.push('icon = ?');
            params.push(iconUrl);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'هیچ فیلدی برای به‌روزرسانی ارسال نشده' });
        }

        params.push(linkId);
        const query = `UPDATE social_links SET ${updates.join(', ')} WHERE id = ?`;
        const result = await db.run(query, params);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'هیچ تغییری اعمال نشد' });
        }

        const updatedLink = await db.get('SELECT * FROM social_links WHERE id = ?', [linkId]);

        res.json({
            success: true,
            message: 'لینک اجتماعی با موفقیت به‌روزرسانی شد',
            data: updatedLink
        });
    } catch (error) {
        console.error('Error updating social link:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'این نام پلتفرم قبلاً ثبت شده است' });
        }

        res.status(500).json({
            error: 'خطای سرور در به‌روزرسانی لینک اجتماعی',
            details: error.message
        });
    }
});

app.delete('/api/admin/socials/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await db.get('SELECT * FROM social_links WHERE id = ?', [id]);

        if (!existing) {
            return res.status(404).json({ error: 'شبکه اجتماعی پیدا نشد' });
        }

        if (existing.icon) {
            const iconPath = existing.icon.replace('/uploads/socials/', 'uploads/socials/');
            if (fs.existsSync(iconPath)) {
                fs.unlinkSync(iconPath);
            }
        }

        await db.run('DELETE FROM social_links WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'شبکه اجتماعی با موفقیت حذف شد'
        });
    } catch (error) {
        console.error('Error in /api/admin/socials DELETE:', error);
        res.status(500).json({ error: error.message });
    }
});

/* ================== INIT DB & START SERVER ================== */
async function startServer() {
    try {
        console.log('📝 Creating database tables...');
        await initDatabase();

        console.log('🌱 Seeding initial data...');
        await fillDb();

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

startServer();