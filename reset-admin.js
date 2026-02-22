const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

// اتصال به دیتابیس
const db = new sqlite3.Database('./database.sqlite');

console.log('🔄 در حال بررسی و ریست کاربر ادمین...');

// هش کردن رمز عبور جدید
const password = 'admin123';
const hashedPassword = bcrypt.hashSync(password, 10);

// اطلاعات کاربر ادمین
const adminUser = {
    username: 'admin',
    email: 'admin@moblfarahzad.com',
    password: hashedPassword,
    full_name: 'مدیر سایت',
    role: 'super_admin',
    permissions: JSON.stringify({
        users: { view: true, add: true, edit: true, delete: true },
        settings: { view: true, add: true, edit: true, delete: true },
        sections: { view: true, add: true, edit: true, delete: true },
        header: { view: true, add: true, edit: true, delete: true },
        hero: { view: true, add: true, edit: true, delete: true },
        collections: { view: true, add: true, edit: true, delete: true },
        products: { view: true, add: true, edit: true, delete: true },
        articles: { view: true, add: true, edit: true, delete: true },
        description: { view: true, add: true, edit: true, delete: true },
        testimonials: { view: true, add: true, edit: true, delete: true },
        footer: { view: true, add: true, edit: true, delete: true }
    })
};

// ابتدا جدول users را بررسی و در صورت نیاز ایجاد کنید
db.serialize(() => {
    // ایجاد جدول users اگر وجود ندارد
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT,
        role TEXT DEFAULT 'admin',
        permissions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('❌ خطا در ایجاد جدول:', err);
        } else {
            console.log('✅ جدول users بررسی/ایجاد شد');
        }
    });

    // پاک کردن کاربر ادمین قبلی (اگر وجود دارد)
    db.run(`DELETE FROM users WHERE username = 'admin' OR email = 'admin@moblfarahzad.com'`, function (err) {
        if (err) {
            console.error('❌ خطا در پاک کردن کاربر قدیمی:', err);
        } else {
            if (this.changes > 0) {
                console.log(`✅ ${this.changes} کاربر قدیمی پاک شد`);
            }
        }
    });

    // ایجاد کاربر ادمین جدید
    db.run(`INSERT INTO users (username, email, password, full_name, role, permissions) 
            VALUES (?, ?, ?, ?, ?, ?)`,
        [adminUser.username, adminUser.email, adminUser.password,
        adminUser.full_name, adminUser.role, adminUser.permissions],
        function (err) {
            if (err) {
                console.error('❌ خطا در ایجاد کاربر جدید:', err);
            } else {
                console.log('✅ کاربر ادمین با موفقیت ایجاد شد');
                console.log('📝 اطلاعات کاربر:');
                console.log(`   نام کاربری: ${adminUser.username}`);
                console.log(`   ایمیل: ${adminUser.email}`);
                console.log(`   رمز عبور: ${password}`);
                console.log(`   نقش: ${adminUser.role}`);
            }
        }
    );

    // نمایش همه کاربران برای بررسی
    setTimeout(() => {
        db.all(`SELECT id, username, email, role, 
                substr(password, 1, 30) as password_preview 
                FROM users`, [], (err, users) => {
            if (err) {
                console.error('❌ خطا در دریافت لیست کاربران:', err);
            } else {
                console.log('\n📋 لیست کاربران دیتابیس:');
                console.log('------------------------');
                users.forEach(user => {
                    console.log(`ID: ${user.id}`);
                    console.log(`Username: ${user.username}`);
                    console.log(`Email: ${user.email}`);
                    console.log(`Role: ${user.role}`);
                    console.log(`Password Hash: ${user.password_preview}...`);
                    console.log('------------------------');
                });
            }
        });
    }, 500);
});

// بستن اتصال دیتابیس بعد از 1 ثانیه
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('❌ خطا در بستن دیتابیس:', err);
        } else {
            console.log('\n✅ عملیات با موفقیت انجام شد');
        }
    });
}, 1000);