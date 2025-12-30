import bcrypt from 'bcryptjs';
import db from './db.js';

export function fillDb() {
  db.prepare(`
    INSERT INTO admins (email, password)
    VALUES (?, ?)
  `).run(
    'admin@test.com',
    bcrypt.hashSync('123456', 10)
  );

  console.log('Admin created');

  const socialPlatforms = [
    { platform: 'telegram', url: '#', icon: '/uploads/socials/telegram.png', display_order: 1 },
    { platform: 'instagram', url: '#', icon: '/uploads/socials/instagram.png', display_order: 2 },
    { platform: 'pinterest', url: '#', icon: '/uploads/socials/pinterest.png', display_order: 3 },
    { platform: 'aparat', url: '#', icon: '/uploads/socials/aparat.png', display_order: 4 },
    { platform: 'youtube', url: '#', icon: '/uploads/socials/youtube.png', display_order: 5 },
    { platform: 'whatsapp', url: '#', icon: '/uploads/socials/whatsapp.png', display_order: 6 }
  ];

  socialPlatforms.forEach(platform => {
    const exists = db.prepare(`SELECT id FROM social_links WHERE platform=?`).get(platform.platform);
    if (!exists) {
      db.prepare(`
        INSERT INTO social_links (platform, url, icon, display_order)
        VALUES (?, ?, ?, ?)
      `).run(platform.platform, platform.url, platform.icon, platform.display_order);
    }
  });
  
  const carousels = [
    { id : '1', type: 'carousel', title: '', url: '/uploads/carousel/carousel1.jpg' },
    { id : '2', type: 'carousel', title: '', url: '/uploads/carousel/carousel2.jpg' },
    { id : '3', type: 'carousel', title: '', url: '/uploads/carousel/carousel3.jpg' },
  ];

  carousels.forEach(x => {
    const exists = db.prepare(`SELECT id FROM images WHERE id=?`).get(x.id);
    if (!exists) {
      db.prepare(`
        INSERT INTO images (type, title, url, price, off, is_tooman)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(x.type, x.title, x.url, '0', '0', 'true');
    }
  });
  
  const articles = [
    { id : '1', title: 'مبل خوب' , content : 'مبلی خوب استولین چیزی که در برخورد با یک مبلمان تو  جه ما را جلب می کند، ظاهر و طراحی آن است. ظاهر یک مبل، به سبک و مدل آن بر می گردد. هر سبک طراحی و ساخت خاص خود را دارد. ظاهر و رنگ بندی مبلمان به تکامل و هماهنگی دکوراسیون داخلی کمک می کند. هنگام خرید یک مبلمان خوب و با کیفیت، علاوه بر ویژگی های ساختاری، باید به ظاهر زیبا و جذاب آن نیز توجه بسیاری کنید. متریال ساخت خوب در کنار ظاهر عالی، یک مبلمان منحصر به فرد را ایجاد می کند.', image_url:  '/uploads/articles/article1.jpg' },
    { id : '2', title: 'مبل راحت', content : 'مبلی خوب استولین چیزی که در برخورد با یک مبلمان تو  جه ما را جلب می کند، ظاهر و طراحی آن است. ظاهر یک مبل، به سبک و مدل آن بر می گردد. هر سبک طراحی و ساخت خاص خود را دارد. ظاهر و رنگ بندی مبلمان به تکامل و هماهنگی دکوراسیون داخلی کمک می کند. هنگام خرید یک مبلمان خوب و با کیفیت، علاوه بر ویژگی های ساختاری، باید به ظاهر زیبا و جذاب آن نیز توجه بسیاری کنید. متریال ساخت خوب در کنار ظاهر عالی، یک مبلمان منحصر به فرد را ایجاد می کند.', image_url: '/uploads/articles/article2.jpg' },
    { id : '3', title: 'مبل قشنگ', content : 'مبلی خوب استولین چیزی که در برخورد با یک مبلمان تو  جه ما را جلب می کند، ظاهر و طراحی آن است. ظاهر یک مبل، به سبک و مدل آن بر می گردد. هر سبک طراحی و ساخت خاص خود را دارد. ظاهر و رنگ بندی مبلمان به تکامل و هماهنگی دکوراسیون داخلی کمک می کند. هنگام خرید یک مبلمان خوب و با کیفیت، علاوه بر ویژگی های ساختاری، باید به ظاهر زیبا و جذاب آن نیز توجه بسیاری کنید. متریال ساخت خوب در کنار ظاهر عالی، یک مبلمان منحصر به فرد را ایجاد می کند.', image_url: '/uploads/articles/article3.jpg' },
  ];

  articles.forEach(x => {
    const exists = db.prepare(`SELECT id FROM articles WHERE id=?`).get(x.id);
    if (!exists) {
      db.prepare(`
        INSERT INTO articles (title, content, image_url)
        VALUES (?, ?, ?)
      `).run(x.title, x.content,  x.image_url);
    }
  });
  
  const categories = [
    { id : '1', title: 'مبل خوب' , description : 'چوب', image_url:  '/uploads/categories/category1.jpg' },
    { id : '2', title: 'مبل راحت', description : 'چستر', image_url: '/uploads/categories/category2.jpg' },
    { id : '3', title: 'مبل قشنگ', description : 'تخت', image_url:  '/uploads/categories/category3.jpg' },
  ];

  categories.forEach(x => {
    const exists = db.prepare(`SELECT id FROM categories WHERE id=?`).get(x.id);
    if (!exists) {
      db.prepare(`
        INSERT INTO categories (title, description, image_url)
        VALUES (?, ?, ?)
      `).run(x.title, x.description,  x.image_url);
    }
  });
  
  const products = [
    { id : '1', category_id : '1', title: 'مبل خوب' ,features:'ویژگی 11',is_active:'true',discount_percent: '0',price:'1200000', description : 'چوب', image_url:  '/uploads/products/products11.jpg' },
    { id : '2', category_id : '1', title: 'مبل راحت',features:'ویژگی 12',is_active:'true',discount_percent: '0',price:'1200000', description : 'چستر', image_url: '/uploads/products/products12.jpg' },
    { id : '3', category_id : '1', title: 'مبل قشنگ',features:'ویژگی 13',is_active:'true',discount_percent: '0',price:'1200000', description : 'تخت', image_url:  '/uploads/products/products13.jpg' },
    { id : '4', category_id : '2', title: 'مبل خوب' ,features:'ویژگی 21',is_active:'true',discount_percent: '0',price:'1200000', description : 'چوب', image_url:  '/uploads/products/products21.jpg' },
    { id : '5', category_id : '2', title: 'مبل راحت',features:'ویژگی 22',is_active:'true',discount_percent: '0',price:'1200000', description : 'چستر', image_url: '/uploads/products/products22.jpg' },
    { id : '6', category_id : '3', title: 'مبل قشنگ',features:'ویژگی 23',is_active:'true',discount_percent: '0',price:'1200000', description : 'تخت', image_url:  '/uploads/products/products23.jpg' },
  ];

  products.forEach(x => {
    const exists = db.prepare(`SELECT id FROM products WHERE id=?`).get(x.id);
    if (!exists) {
      db.prepare(`
        INSERT INTO products (category_id, title, features,is_active,discount_percent, price, description, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(x.category_id, x.title, x.features,x.is_active,x.discount_percent, x.price, x.description, x.image_url);
    }
  });
}
