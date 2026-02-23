const express = require("express");
const cors = require("cors");
const db = require("./db");
require("./seed"); // اجرای seed

const app = express();
app.use(cors());
app.use(express.json());

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const multer = require("multer");
const path = require("path");

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});

const upload = multer({ storage });

app.use("/uploads", express.static("uploads"));

const SECRET = "SUPER_SECRET_KEY";

const PORT = 3001;

// ✅ دریافت منوها (public)
app.get("/api/menu", (req, res) => {
  db.all("SELECT * FROM menu_items ORDER BY order_index", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

//Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, user) => {
      if (!user) return res.status(401).json({ message: "Invalid" });

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid" });

      const token = jwt.sign({ id: user.id, is_admin: user.is_admin }, SECRET, {
        expiresIn: "7d",
      });

      res.json({ token });
    },
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
//Login

//*********************************************************************** */

//Hero
app.get("/api/hero", (req, res) => {
  db.get("SELECT * FROM hero_settings LIMIT 1", (err, row) => {
    res.json(row);
  });
});
app.post(
  "/api/hero",
  authAdmin,
  upload.fields([{ name: "desktop" }, { name: "mobile" }]),
  (req, res) => {
    const desktop = req.files["desktop"]
      ? "/uploads/" + req.files["desktop"][0].filename
      : null;

    const mobile = req.files["mobile"]
      ? "/uploads/" + req.files["mobile"][0].filename
      : null;

      const oldHero = db.prepare("SELECT * FROM hero_settings LIMIT 1").get();
      console.log(oldHero);
      
      if (req.files.desktop && oldHero.desktop_image) {
        const oldDesktopFile = path.basename(oldHero.desktop_image);
        const prevDesktopPath = path.join(__dirname, "uploads", oldDesktopFile);
        if (fs.existsSync(prevDesktopPath)) fs.unlinkSync(prevDesktopPath);
      }

      if (req.files.mobile && oldHero.mobile_image) {
        const oldMobileFile = path.basename(oldHero.mobile_image);
        const prevMobilePath = path.join(__dirname, "uploads", oldMobileFile);
        if (fs.existsSync(prevMobilePath)) fs.unlinkSync(prevMobilePath);
      }

    db.run(
      "UPDATE hero_settings SET desktop_image=?, mobile_image=? WHERE id=1",
      [desktop, mobile],
      () => {
        res.json({ success: true });
      },
    );
  },
);

//Hero

//Collections

// GET /api/collections → دریافت همه کالکشن‌ها
app.get("/api/collections", (req, res) => {
  db.all("SELECT * FROM collections", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /api/collections → اضافه کردن کالکشن جدید
app.post(
  "/api/collections",
  upload.fields([{ name: "desktop" }, { name: "mobile" }]),
  (req, res) => {
    const { title } = req.body;
    const desktop = req.files["desktop"]
      ? `/uploads/${req.files["desktop"][0].filename}`
      : "";
    const mobile = req.files["mobile"]
      ? `/uploads/${req.files["mobile"][0].filename}`
      : "";

    db.run(
      "INSERT INTO collections (title, desktop_image, mobile_image) VALUES (?, ?, ?)",
      [title, desktop, mobile],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        db.get(
          "SELECT * FROM collections WHERE id = ?",
          [this.lastID],
          (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(row);
          },
        );
      },
    );
  },
);

// PUT /api/collections/:id → ویرایش کالکشن
app.put(
  "/api/collections/:id",
  upload.fields([{ name: "desktop" }, { name: "mobile" }]),
  (req, res) => {
    const { id } = req.params;
    const { title } = req.body;

    db.get("SELECT * FROM collections WHERE id = ?", [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: "Collection not found" });

      const desktop = req.files["desktop"]
        ? `/uploads/${req.files["desktop"][0].filename}`
        : row.desktop_image;
      const mobile = req.files["mobile"]
        ? `/uploads/${req.files["mobile"][0].filename}`
        : row.mobile_image;

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
            },
          );
        },
      );
    });
  },
);

// DELETE /api/collections/:id → حذف کالکشن
app.delete("/api/collections/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM collections WHERE id = ?", [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});
//Collections

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
