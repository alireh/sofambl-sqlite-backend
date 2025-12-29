import Database from 'better-sqlite3';
import fs from 'fs';

const dbPath =
  process.env.NODE_ENV === "production"
    ? "/data/database.sqlite"
    : "database.sqlite";

// اطمینان از وجود فولدر
if (process.env.NODE_ENV === "production") {
  if (!fs.existsSync('/data')) {
    fs.mkdirSync('/data', { recursive: true });
  }
}

const db = new Database(dbPath);

export default db;
