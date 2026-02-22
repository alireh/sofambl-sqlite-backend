const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'mobl-farahzad-secret-key-2024';

// CORS
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());

// دیتابیس
const db = new sqlite3.Database('./database.sqlite');

// ایجاد جدول کاربران
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT,
        full_name TEXT,
        role TEXT
    )`);

    // ایجاد کاربر پیش‌فرض
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR REPLACE INTO users (username, email, password, full_name, role) 
            VALUES (?, ?, ?, ?, ?)`,
        ['admin', 'admin@example.com', hashedPassword, 'مدیر سایت', 'admin']
    );
});

// تست
app.get('/api/test', (req, res) => {
    res.json({ message: 'سرور کار می‌کند' });
});

// لاگین - نسخه ساده شده
app.post('/api/admin/login', (req, res) => {
    console.log('📥 درخواست لاگین:', req.body);

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'ایمیل و رمز عبور الزامی است'
        });
    }

    db.get(`SELECT * FROM users WHERE username = ? OR email = ?`, [email, email], (err, user) => {
        if (err) {
            console.error('خطای دیتابیس:', err);
            return res.status(500).json({
                success: false,
                message: 'خطای داخلی سرور'
            });
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'کاربر یافت نشد'
            });
        }

        const isValid = bcrypt.compareSync(password, user.password);

        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: 'رمز عبور اشتباه است'
            });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                full_name: user.full_name,
                role: user.role
            }
        });
    });
});

// دریافت اطلاعات کاربر
app.get('/api/admin/me', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'توکن یافت نشد'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'توکن نامعتبر است'
            });
        }

        db.get(`SELECT id, username, email, full_name, role FROM users WHERE id = ?`,
            [user.id],
            (err, userData) => {
                if (err || !userData) {
                    return res.status(404).json({
                        success: false,
                        message: 'کاربر یافت نشد'
                    });
                }

                res.json({
                    success: true,
                    user: userData
                });
            }
        );
    });
});

// ============== مسیرهای ادمین برای مدیریت هدر ==============

// دریافت همه آیتم‌های هدر (برای ادمین)
app.get('/api/admin/header', (req, res) => {
    console.log('📥 درخواست GET /api/admin/header');

    // چک کردن توکن
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'توکن یافت نشد'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: 'توکن نامعتبر است'
            });
        }

        // دریافت داده‌ها از دیتابیس
        db.all(`SELECT * FROM header ORDER BY "order"`, [], (err, rows) => {
            if (err) {
                console.error('خطا در دریافت:', err);
                return res.status(500).json({
                    success: false,
                    message: 'خطا در دریافت داده‌ها'
                });
            }

            res.json({
                success: true,
                data: rows || []
            });
        });
    });
});

// دریافت یک آیتم
app.get('/api/admin/header/:id', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'توکن یافت نشد' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'توکن نامعتبر است' });
        }

        db.get(`SELECT * FROM header WHERE id = ?`, [req.params.id], (err, row) => {
            if (err || !row) {
                return res.status(404).json({
                    success: false,
                    message: 'آیتم یافت نشد'
                });
            }

            res.json({
                success: true,
                data: row
            });
        });
    });
});

// ایجاد آیتم جدید
app.post('/api/admin/header', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'توکن یافت نشد' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'توکن نامعتبر است' });
        }

        const { title, link, parent_id, order, is_visible } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'عنوان الزامی است'
            });
        }

        db.run(
            `INSERT INTO header (title, link, parent_id, "order", is_visible) 
             VALUES (?, ?, ?, ?, ?)`,
            [title, link || '#', parent_id || 0, order || 0, is_visible !== undefined ? is_visible : 1],
            function (err) {
                if (err) {
                    console.error('خطا در ایجاد:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'خطا در ایجاد آیتم'
                    });
                }

                res.json({
                    success: true,
                    message: 'آیتم با موفقیت ایجاد شد',
                    id: this.lastID
                });
            }
        );
    });
});

// ویرایش آیتم
app.put('/api/admin/header/:id', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'توکن یافت نشد' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'توکن نامعتبر است' });
        }

        const { title, link, parent_id, order, is_visible } = req.body;

        db.run(
            `UPDATE header 
             SET title = ?, link = ?, parent_id = ?, "order" = ?, is_visible = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [title, link, parent_id, order, is_visible, req.params.id],
            function (err) {
                if (err) {
                    console.error('خطا در ویرایش:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'خطا در ویرایش آیتم'
                    });
                }

                if (this.changes === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'آیتم یافت نشد'
                    });
                }

                res.json({
                    success: true,
                    message: 'آیتم با موفقیت ویرایش شد'
                });
            }
        );
    });
});

// حذف آیتم
app.delete('/api/admin/header/:id', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'توکن یافت نشد' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'توکن نامعتبر است' });
        }

        // اول چک کن بچه‌داری نداره؟
        db.get(`SELECT COUNT(*) as count FROM header WHERE parent_id = ?`, [req.params.id], (err, row) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'خطا در بررسی آیتم'
                });
            }

            if (row.count > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'این آیتم زیرمجموعه دارد. اول زیرمجموعه‌ها را حذف کنید'
                });
            }

            db.run(`DELETE FROM header WHERE id = ?`, [req.params.id], function (err) {
                if (err) {
                    console.error('خطا در حذف:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'خطا در حذف آیتم'
                    });
                }

                if (this.changes === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'آیتم یافت نشد'
                    });
                }

                res.json({
                    success: true,
                    message: 'آیتم با موفقیت حذف شد'
                });
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 سرور روی پورت ${PORT} راه‌اندازی شد`);
    console.log(`👤 admin / admin123`);
});