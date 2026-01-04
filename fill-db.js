// fill-db.js - نسخه MySQL
import bcrypt from 'bcryptjs';
import db from './db.js';

export async function fillDb() {
  try {
    console.log('🌱 شروع پر کردن داده‌های اولیه در MySQL...');

    // seed site
    const siteExists = await db.get(`SELECT 1 FROM site WHERE id = 1`);
    if (!siteExists) {
      await db.run(
        `INSERT INTO site (id, about, address, email, phone) 
                 VALUES (1, ?, ?, ?, ?)`,
        [
          'مبل فرحزاد فعالیت خود را با هدف جلب رضایت مشتریان گرامی خود آغاز کرده...',
          'تهران',
          'info@test.com',
          '09120000000'
        ]
      );
      console.log('✅ سایت ایجاد شد');
    }

    // seed settings
    const settingsExists = await db.get(`SELECT 1 FROM site_settings WHERE id = 1`);
    if (!settingsExists) {
      await db.run(
        `INSERT INTO site_settings (id, show_carousel, max_carousel_items, article_display_mode) 
                 VALUES (1, 1, 5, 'card')`
      );
      console.log('✅ تنظیمات سایت ایجاد شد');
    }

    // seed admin
    const password = 'Aa12345678';
    const hashed = bcrypt.hashSync(password, 10);

    const adminExists = await db.get(`SELECT id FROM admins WHERE id = 1`);
    if (!adminExists) {
      await db.run(
        `INSERT INTO admins (id, name, email, password) 
                 VALUES (1, 'admin', ?, ?)`,
        ['farahzad@test.com', hashed]
      );
      console.log('✅ ادمین ایجاد شد - ایمیل: farahzad@test.com, رمز عبور: Aa12345678');
    }

    // seed social platforms
    const socialPlatforms = [
      { platform: 'telegram', url: '#', icon: '/uploads/socials/telegram.png', display_order: 1 },
      { platform: 'instagram', url: '#', icon: '/uploads/socials/instagram.png', display_order: 2 },
      { platform: 'pinterest', url: '#', icon: '/uploads/socials/pinterest.png', display_order: 3 },
      { platform: 'aparat', url: '#', icon: '/uploads/socials/aparat.png', display_order: 4 },
      { platform: 'youtube', url: '#', icon: '/uploads/socials/youtube.png', display_order: 5 },
      { platform: 'whatsapp', url: '#', icon: '/uploads/socials/whatsapp.png', display_order: 6 }
    ];

    for (const platform of socialPlatforms) {
      const exists = await db.get(`SELECT id FROM social_links WHERE platform = ?`, [platform.platform]);
      if (!exists) {
        await db.run(
          `INSERT INTO social_links (platform, url, icon, display_order, is_active) 
                     VALUES (?, ?, ?, ?, 1)`,
          [platform.platform, platform.url, platform.icon, platform.display_order]
        );
        console.log(`✅ پلتفرم اجتماعی ${platform.platform} اضافه شد`);
      }
    }

    // seed carousels
    const carousels = [
      { type: 'carousel', title: '', url: '/uploads/carousel/carousel1.jpg' },
      { type: 'carousel', title: '', url: '/uploads/carousel/carousel2.jpg' },
      { type: 'carousel', title: '', url: '/uploads/carousel/carousel3.jpg' },
    ];

    for (const x of carousels) {
      const exists = await db.get(`SELECT id FROM images WHERE url = ?`, [x.url]);
      if (!exists) {
        await db.run(
          `INSERT INTO images (type, title, url, price, off, is_tooman) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
          [x.type, x.title, x.url, 0, 0, 1]
        );
        console.log(`✅ تصویر کاروسل ${x.url} اضافه شد`);
      }
    }

    // seed articles
    const articles = [
      {
        title: 'مبل خوب',
        content: 'مبلی خوب استولین چیزی که در برخورد با یک مبلمان توجه ما را جلب می‌کند...',
        image_url: '/uploads/articles/article1.jpg'
      },
      {
        title: 'مبل راحت',
        content: 'مبلی خوب استولین چیزی که در برخورد با یک مبلمان توجه ما را جلب می‌کند...',
        image_url: '/uploads/articles/article2.jpg'
      },
      {
        title: 'مبل قشنگ',
        content: 'مبلی خوب استولین چیزی که در برخورد با یک مبلمان توجه ما را جلب می‌کند...',
        image_url: '/uploads/articles/article3.jpg'
      },
    ];

    for (const article of articles) {
      const exists = await db.get(`SELECT id FROM articles WHERE title = ?`, [article.title]);
      if (!exists) {
        await db.run(
          `INSERT INTO articles (title, content, image_url) 
                     VALUES (?, ?, ?)`,
          [article.title, article.content, article.image_url]
        );
        console.log(`✅ مقاله "${article.title}" اضافه شد`);
      }
    }

    // seed categories
    const categories = [
      { title: 'مبل خوب', description: 'چوب', image_url: '/uploads/categories/category1.jpg' },
      { title: 'مبل راحت', description: 'چستر', image_url: '/uploads/categories/category2.jpg' },
      { title: 'مبل قشنگ', description: 'تخت', image_url: '/uploads/categories/category3.jpg' },
    ];

    for (const category of categories) {
      const exists = await db.get(`SELECT id FROM categories WHERE title = ?`, [category.title]);
      if (!exists) {
        const result = await db.run(
          `INSERT INTO categories (title, description, image_url) 
                     VALUES (?, ?, ?)`,
          [category.title, category.description, category.image_url]
        );

        const categoryId = result.lastID;
        console.log(`✅ دسته‌بندی "${category.title}" با ID ${categoryId} اضافه شد`);

        // seed products for each category
        const products = [
          {
            title: `${category.title} - مدل 1`,
            features: JSON.stringify(['ویژگی 1', 'ویژگی 2', 'ویژگی 3']),
            price: 1200000,
            description: category.description,
            image_url: '/uploads/products/product1.jpg'
          },
          {
            title: `${category.title} - مدل 2`,
            features: JSON.stringify(['ویژگی 1', 'ویژگی 2', 'ویژگی 3']),
            price: 1500000,
            description: category.description,
            image_url: '/uploads/products/product2.jpg'
          },
        ];

        for (const product of products) {
          await db.run(
            `INSERT INTO products (category_id, title, image_url, price, discount_percent, description, features, is_active) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [
              categoryId,
              product.title,
              product.image_url,
              product.price,
              0,
              product.description,
              product.features
            ]
          );
          console.log(`✅ محصول "${product.title}" اضافه شد`);
        }
      }
    }

    console.log('✅ پر کردن داده‌های اولیه در MySQL با موفقیت انجام شد');
    return true;
  } catch (error) {
    console.error('❌ خطا در پر کردن داده‌های اولیه MySQL:', error);
    throw error;
  }
}