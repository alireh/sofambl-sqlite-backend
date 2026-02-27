const express = require("express");
const cors = require("cors");
const db = require("./db");
require("./seed");

const app = express();
app.use(cors());
app.use(express.json());

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const multer = require("multer");
const path = require("path");
const fs = require("fs");

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});

const getFileExtension = function (filename) {
  const parts = filename.split(".");
  return parts.pop();
};

const videoDir = path.join(__dirname, "uploads", "video");
if (!fs.existsSync(videoDir)) {
  fs.mkdirSync(videoDir, { recursive: true });
}

const workFlowImgDir = path.join(__dirname, "uploads", "workFlowImage");
if (!fs.existsSync(workFlowImgDir)) {
  fs.mkdirSync(workFlowImgDir, { recursive: true });
}

const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, videoDir);
  },
  filename: (req, file, cb) => {
    // const uniqueName =
    //   Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    // cb(null, uniqueName); 
    cb(null, `video.${file.originalname.split(".").pop()}`);
  },
});

const videoUpload = multer({ storage: videoStorage });


const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/workFlowImage/");
  },
  filename: function (req, file, cb) {
    const ext = file.originalname.split(".").pop();
    cb(null, `image.${ext}`);
  },
});

const imageUpload = multer({ storage: imageStorage });

const upload = multer({ storage });

const SECRET = "SUPER_SECRET_KEY";
const PORT = 3001;

// ================= MENU =================
app.get("/api/menu", (req, res) => {
  db.all("SELECT * FROM menu_items ORDER BY order_index", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ================= LOGIN =================
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (!user) return res.status(401).json({ message: "Invalid" });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid" });

      const token = jwt.sign(
        { id: user.id, is_admin: user.is_admin },
        SECRET,
        { expiresIn: "7d" }
      );

      res.json({ token });
    }
  );
});

function authAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.sendStatus(401);

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, SECRET);
    if (!decoded.is_admin) return res.sendStatus(403);
    req.user = decoded;
    next();
  } catch {
    res.sendStatus(401);
  }
}

// ================= HERO =================
app.get("/api/hero", (req, res) => {
  db.get("SELECT * FROM hero_settings LIMIT 1", (err, row) => {
    if (err) return res.status(500).json(err);
    res.json(row);
  });
});

app.post(
  "/api/hero",
  authAdmin,
  upload.fields([{ name: "desktop" }, { name: "mobile" }]),
  (req, res) => {
    const desktop = req.files?.desktop
      ? "/uploads/" + req.files.desktop[0].filename
      : null;

    const mobile = req.files?.mobile
      ? "/uploads/" + req.files.mobile[0].filename
      : null;

    db.get("SELECT * FROM hero_settings LIMIT 1", (err, oldHero) => {
      if (err) return res.status(500).json(err);

      // حذف قبلی دسکتاپ
      if (req.files?.desktop && oldHero?.desktop_image) {
        const oldFile = path.basename(oldHero.desktop_image);
        const filePath = path.join(__dirname, "uploads", oldFile);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      // حذف قبلی موبایل
      if (req.files?.mobile && oldHero?.mobile_image) {
        const oldFile = path.basename(oldHero.mobile_image);
        const filePath = path.join(__dirname, "uploads", oldFile);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      db.run(
        "UPDATE hero_settings SET desktop_image=?, mobile_image=? WHERE id=1",
        [desktop, mobile],
        () => res.json({ success: true })
      );
    });
  }
);

// ================= Menus =================

app.post("/api/menu", authAdmin, (req, res) => {
  const { title, url, order_index } = req.body;

  db.run(
    "INSERT INTO menu_items (title, url, order_index) VALUES (?, ?, ?)",
    [title, url, order_index],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ id: this.lastID });
    },
  );
});
app.put("/api/menu/:id", authAdmin, (req, res) => {
  const { title, url, order_index } = req.body;

  db.run(
    "UPDATE menu_items SET title=?, url=?, order_index=? WHERE id=?",
    [title, url, order_index, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    },
  );
});
app.delete("/api/menu/:id", authAdmin, (req, res) => {
  db.run("DELETE FROM menu_items WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ success: true });
  });
});
// ================= COLLECTIONS =================
app.get("/api/collections", (req, res) => {
  db.all("SELECT * FROM collections", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post(
  "/api/collections",
  upload.fields([{ name: "desktop" }, { name: "mobile" }]),
  (req, res) => {
    const { title } = req.body;

    const desktop = req.files?.desktop
      ? `/uploads/${req.files.desktop[0].filename}`
      : "";

    const mobile = req.files?.mobile
      ? `/uploads/${req.files.mobile[0].filename}`
      : "";

    db.run(
      "INSERT INTO collections (title, desktop_image, mobile_image) VALUES (?, ?, ?)",
      [title, desktop, mobile],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        db.get(
          "SELECT * FROM collections WHERE id = ?",
          [this.lastID],
          (err, row) => res.json(row)
        );
      }
    );
  }
);


// DELETE /api/collections/:id → حذف کالکشن و تصاویرش
app.delete("/api/collections/:id", authAdmin, (req, res) => {
  const { id } = req.params;

  db.get("SELECT * FROM collections WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Collection not found" });

    // پاک کردن تصاویر کالکشن
    const desktopPath = path.join(__dirname, row.desktop_image);
    const mobilePath = path.join(__dirname, row.mobile_image);

    if (fs.existsSync(desktopPath)) fs.unlinkSync(desktopPath);
    if (fs.existsSync(mobilePath)) fs.unlinkSync(mobilePath);

    db.run("DELETE FROM collections WHERE id = ?", [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});


// PUT /api/collections/:id → ویرایش کالکشن
app.put(
  "/api/collections/:id",
  authAdmin,
  upload.fields([{ name: "desktop" }, { name: "mobile" }]),
  (req, res) => {
    const { id } = req.params;
    const { title } = req.body;

    db.get("SELECT * FROM collections WHERE id = ?", [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "Collection not found" });

      // اگر فایل جدید آپلود شد، تصاویر قبلی را پاک کن
      let desktop = row.desktop_image;
      let mobile = row.mobile_image;

      if (req.files["desktop"]) {
        if (fs.existsSync(path.join(__dirname, desktop))) fs.unlinkSync(path.join(__dirname, desktop));
        desktop = `/uploads/${req.files["desktop"][0].filename}`;
      }

      if (req.files["mobile"]) {
        if (fs.existsSync(path.join(__dirname, mobile))) fs.unlinkSync(path.join(__dirname, mobile));
        mobile = `/uploads/${req.files["mobile"][0].filename}`;
      }

      db.run(
        "UPDATE collections SET title = ?, desktop_image = ?, mobile_image = ? WHERE id = ?",
        [title, desktop, mobile, id],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          db.get(
            "SELECT * FROM collections WHERE id = ?",
            [id],
            (err, updatedRow) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json(updatedRow);
            }
          );
        }
      );
    });
  }
);


// ================= SUB COLLECTIONS =================
app.get("/api/sub-collections/:collectionId", (req, res) => {
  const { collectionId } = req.params;

  db.all(
    "SELECT id, name, image, price, old_price, collection_id FROM sub_collections WHERE collection_id = ?",
    [collectionId],
    (err, rows) => {
      if (err) return res.status(500).json(err);
      res.json(rows);
    }
  );
});
app.post(
  "/api/sub-collections",
  authAdmin,
  upload.single("image"),
  (req, res) => {
    const { collection_id, name, price, old_price } = req.body;

    if (!req.file)
      return res.status(400).json({ error: "Image is required" });

    const image = `/uploads/${req.file.filename}`;

    db.run(
      `INSERT INTO sub_collections 
       (collection_id, name, image, price, old_price)
       VALUES (?, ?, ?, ?, ?)`,
      [collection_id, name, image, price, old_price || null],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        db.get(
          "SELECT * FROM sub_collections WHERE id = ?",
          [this.lastID],
          (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(row);
          }
        );
      }
    );
  }
);

app.put(
  "/api/sub-collections/:id",
  authAdmin,
  upload.single("image"),
  (req, res) => {
    const { id } = req.params;
    const { name, price, old_price } = req.body;

    db.get(
      "SELECT * FROM sub_collections WHERE id = ?",
      [id],
      (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row)
          return res.status(404).json({ error: "SubCollection not found" });

        let newImage = row.image;

        // اگر عکس جدید آپلود شد
        if (req.file) {
          newImage = `/uploads/${req.file.filename}`;

          // حذف عکس قبلی
          if (row.image) {
            const oldFile = path.basename(row.image);
            const oldPath = path.join(__dirname, "uploads", oldFile);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }
        }

        db.run(
          `UPDATE sub_collections
           SET name=?, image=?, price=?, old_price=?
           WHERE id=?`,
          [name, newImage, price, old_price || null, id],
          function (err) {
            if (err) return res.status(500).json({ error: err.message });

            db.get(
              "SELECT * FROM sub_collections WHERE id=?",
              [id],
              (err, updated) => {
                if (err)
                  return res.status(500).json({ error: err.message });
                res.json(updated);
              }
            );
          }
        );
      }
    );
  }
);

app.delete("/api/sub-collections/:id", authAdmin, (req, res) => {
  const { id } = req.params;

  db.get(
    "SELECT image FROM sub_collections WHERE id=?",
    [id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row)
        return res.status(404).json({ error: "SubCollection not found" });

      // حذف فایل
      if (row.image) {
        const oldFile = path.basename(row.image);
        const oldPath = path.join(__dirname, "uploads", oldFile);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }

      db.run(
        "DELETE FROM sub_collections WHERE id=?",
        [id],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true });
        }
      );
    }
  );
});
// ================= Best Sellers =================
app.get("/api/best-sellers", (req, res) => {
  db.all(
    "SELECT * FROM best_sellers ORDER BY id DESC LIMIT 4",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});
app.post(
  "/api/best-sellers",
  authAdmin,
  upload.single("image"),
  (req, res) => {
    const { title, rating, price } = req.body;

    db.get("SELECT COUNT(*) as count FROM best_sellers", (err, row) => {
      if (row.count >= 4) {
        return res.status(400).json({ error: "حداکثر ۴ محصول مجاز است" });
      }

      const image = req.file ? `/uploads/${req.file.filename}` : "";

      db.run(
        "INSERT INTO best_sellers (title, image, rating, price) VALUES (?, ?, ?, ?)",
        [title, image, rating, price],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          db.get(
            "SELECT * FROM best_sellers WHERE id = ?",
            [this.lastID],
            (err, row) => {
              res.json(row);
            }
          );
        }
      );
    });
  }
);
app.put(
  "/api/best-sellers/:id",
  authAdmin,
  upload.single("image"),
  (req, res) => {
    const { id } = req.params;
    const { title, rating, price } = req.body;

    db.get("SELECT * FROM best_sellers WHERE id = ?", [id], (err, row) => {
      if (!row) return res.status(404).json({ error: "Not found" });

      let image = row.image;

      if (req.file) {
        image = `/uploads/${req.file.filename}`;
      }

      db.run(
        `UPDATE best_sellers
         SET title=?, image=?, rating=?, price=?
         WHERE id=?`,
        [title, image, rating, price, id],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          db.get(
            "SELECT * FROM best_sellers WHERE id=?",
            [id],
            (err, updated) => res.json(updated)
          );
        }
      );
    });
  }
);
app.delete("/api/best-sellers/:id", authAdmin, (req, res) => {
  db.run(
    "DELETE FROM best_sellers WHERE id=?",
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});



// ================= Common Questions =================
app.get("/api/common_questions", (req, res) => {
  db.all(
    "SELECT * FROM common_questions ORDER BY id DESC",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});


app.post("/api/common_questions", authAdmin, (req, res) => {
  const { question, answer } = req.body;

  const result = db.prepare(`
    INSERT INTO common_questions (question, answer)
    VALUES (?, ?)
  `).run(question, answer);

  const newItem = db.prepare(`
    SELECT * FROM common_questions WHERE id = ?
  `).get(result.lastInsertRowid);

  res.json(newItem);
});


app.put("/api/common_questions/:id", authAdmin, (req, res) => {
  const { question, answer } = req.body;
  const { id } = req.params;

  db.prepare(`
    UPDATE common_questions
    SET question = ?, answer = ?
    WHERE id = ?
  `).run(question, answer, id);

  const updated = db.prepare(`
    SELECT * FROM common_questions WHERE id = ?
  `).get(id);

  res.json(updated);
});


app.delete("/api/common_questions/:id", authAdmin, (req, res) => {
  db.prepare(`
    DELETE FROM common_questions WHERE id = ?
  `).run(req.params.id);

  res.json({ success: true });
});

// ================= Articles =================
// GET all articles (public - با محدودیت)
app.get("/api/articles", (req, res) => {
  const take = Number(req.query.take) || 4;

  db.all(
    `SELECT * FROM articles 
     WHERE is_active = 1 
     ORDER BY datetime(created_at) DESC 
     LIMIT ?`,
    [take],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// GET all articles for admin (بدون محدودیت)
app.get("/api/articles/admin", authAdmin, (req, res) => {
  db.all(
    "SELECT * FROM articles ORDER BY datetime(created_at) DESC",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// POST new article
app.post("/api/articles", authAdmin, upload.fields([
  { name: "image", maxCount: 1 },
  { name: "desktop", maxCount: 1 },
  { name: "mobile", maxCount: 1 }
]), (req, res) => {
  const {
    title,
    summary,
    full_content,
    author,
    read_time,
    category
  } = req.body;

  const image = req.files?.image ? `/uploads/${req.files.image[0].filename}` : null;
  const desktop_image = req.files?.desktop ? `/uploads/${req.files.desktop[0].filename}` : null;
  const mobile_image = req.files?.mobile ? `/uploads/${req.files.mobile[0].filename}` : null;

  const created_at = new Date().toLocaleDateString("fa-IR");

  db.run(
    `INSERT INTO articles 
     (title, summary, full_content, image, desktop_image, mobile_image, created_at, author, read_time, category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, summary, full_content || "", image, desktop_image, mobile_image, created_at, author, read_time, category],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      db.get(
        "SELECT * FROM articles WHERE id = ?",
        [this.lastID],
        (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(row);
        }
      );
    }
  );
});

// PUT update article
app.put("/api/articles/:id", authAdmin, upload.fields([
  { name: "image", maxCount: 1 },
  { name: "desktop", maxCount: 1 },
  { name: "mobile", maxCount: 1 }
]), (req, res) => {
  const { id } = req.params;
  const {
    title,
    summary,
    full_content,
    author,
    read_time,
    category
  } = req.body;

  // اول مقاله موجود را دریافت کن
  db.get("SELECT * FROM articles WHERE id = ?", [id], (err, article) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!article) return res.status(404).json({ error: "Article not found" });

    // تصاویر جدید یا قبلی
    let image = article.image;
    let desktop_image = article.desktop_image;
    let mobile_image = article.mobile_image;

    // اگر تصویر جدید آپلود شده
    if (req.files?.image) {
      image = `/uploads/${req.files.image[0].filename}`;
      // حذف تصویر قبلی
      if (article.image) {
        const oldPath = path.join(__dirname, article.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    if (req.files?.desktop) {
      desktop_image = `/uploads/${req.files.desktop[0].filename}`;
      if (article.desktop_image) {
        const oldPath = path.join(__dirname, article.desktop_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    if (req.files?.mobile) {
      mobile_image = `/uploads/${req.files.mobile[0].filename}`;
      if (article.mobile_image) {
        const oldPath = path.join(__dirname, article.mobile_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    // بروزرسانی مقاله
    db.run(
      `UPDATE articles 
       SET title = ?, summary = ?, full_content = ?, image = ?, 
           desktop_image = ?, mobile_image = ?, author = ?, 
           read_time = ?, category = ?
       WHERE id = ?`,
      [title, summary, full_content || "", image, desktop_image, mobile_image, author, read_time, category, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });

        db.get(
          "SELECT * FROM articles WHERE id = ?",
          [id],
          (err, updated) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(updated);
          }
        );
      }
    );
  });
});

// DELETE article
app.delete("/api/articles/:id", authAdmin, (req, res) => {
  const { id } = req.params;

  // اول تصاویر را دریافت و حذف کن
  db.get("SELECT image, desktop_image, mobile_image FROM articles WHERE id = ?", [id], (err, article) => {
    if (err) return res.status(500).json({ error: err.message });

    // حذف فایل‌ها
    if (article) {
      [article.image, article.desktop_image, article.mobile_image].forEach(imgPath => {
        if (imgPath) {
          const fullPath = path.join(__dirname, imgPath);
          if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        }
      });
    }

    // حذف از دیتابیس
    db.run("DELETE FROM articles WHERE id = ?", [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// ================= Footer =================
app.get("/api/footer", (req, res) => {
  db.get("SELECT * FROM footer_settings WHERE id=1", (err, row) => {
    if (err) return res.status(500).json(err);

    if (!row) return res.json(null);

    row.useful_links = row.useful_links
      ? JSON.parse(row.useful_links)
      : [];

    row.socials = row.socials
      ? JSON.parse(row.socials)
      : [];

    res.json(row);
  });
});

app.put("/api/footer", (req, res) => {
  const {
    about_text,
    address,
    phone,
    mobile,
    email,
    work_sat_wed,
    work_thu,
    work_fri,
    copyright,
    useful_links,
    socials,
  } = req.body;

  db.run(
    `UPDATE footer_settings SET
      about_text=?,
      address=?,
      phone=?,
      mobile=?,
      email=?,
      work_sat_wed=?,
      work_thu=?,
      work_fri=?,
      copyright=?,
      useful_links=?,
      socials=?
     WHERE id=1`,
    [
      about_text,
      address,
      phone,
      mobile,
      email,
      work_sat_wed,
      work_thu,
      work_fri,
      copyright,
      JSON.stringify(useful_links || []),
      JSON.stringify(socials || []),
    ],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});


app.put("/api/footer", (req, res) => {
  const {
    about_text,
    address,
    phone,
    mobile,
    email,
    work_sat_wed,
    work_thu,
    work_fri,
    copyright,
    useful_links,
    socials,
  } = req.body;

  db.run(
    `UPDATE footer_settings SET
      about_text=?,
      address=?,
      phone=?,
      mobile=?,
      email=?,
      work_sat_wed=?,
      work_thu=?,
      work_fri=?,
      copyright=?,
      useful_links=?,
      socials=?
     WHERE id=1`,
    [
      about_text,
      address,
      phone,
      mobile,
      email,
      work_sat_wed,
      work_thu,
      work_fri,
      copyright,
      JSON.stringify(useful_links || []),
      JSON.stringify(socials || []),
    ],
    function (err) {
      if (err) return res.status(500).json(err);
      res.json({ success: true });
    }
  );
});
// ================= Description =================
app.get("/api/description", (req, res) => {
  db.get("SELECT * FROM description WHERE id=1", (err, row) => {
    if (err) return res.status(500).json(err);

    if (!row) return res.json(null);

    res.json(row);
  });
});

app.put("/api/description", authAdmin, (req, res) => {
  const { title, content } = req.body;
  const { id } = req.params;

  db.prepare(`
    UPDATE description
    SET title = ?, content = ?
    WHERE id = 1
  `).run(title, content);

  const updated = db.prepare(`
    SELECT * FROM description WHERE id = 1
  `).get(id);

  res.json(updated);
});



app.post("/api/upload-video", authAdmin, videoUpload.single("video"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video uploaded" });
    }

    const ext = getFileExtension(req.file.originalname);
    const videoUrl = `/uploads/video/video.${ext}`;
    // const videoUrl = `/uploads/video/${req.file.filename}`;

    res.json({
      success: true,
      url: videoUrl,
      filename: `video.${ext}‍`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.get("/api/get-video", (req, res) => {
  try {
    const videoDir = path.join(__dirname, "uploads/video");

    // خواندن فایل‌های پوشه
    const files = fs.readdirSync(videoDir);

    // پیدا کردن فایلی که با video شروع می‌شود
    const videoFile = files.find((f) => f.startsWith("video."));

    if (!videoFile) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json({
      success: true,
      url: `/uploads/video/${videoFile}`,
      filename: videoFile,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get video" });
  }
});

app.post("/api/upload-image", authAdmin, imageUpload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const ext = req.file.originalname.split(".").pop();
    const imageUrl = `/uploads/workFlowImage/workFlowImage.${ext}`;

    res.json({
      success: true,
      url: imageUrl,
      filename: `workFlowImage.${ext}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

app.get("/api/get-image", (req, res) => {
  try {
    const imageDir = path.join(__dirname, "uploads/workFlowImage");
    const files = fs.readdirSync(imageDir);

    const imageFile = files.find((f) => f.startsWith("image."));

    if (!imageFile) {
      return res.status(404).json({ error: "Image not found" });
    }

    res.json({
      success: true,
      url: `/uploads/workFlowImage/${imageFile}`,
      filename: imageFile,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get image" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});