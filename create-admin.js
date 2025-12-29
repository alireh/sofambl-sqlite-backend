import bcrypt from 'bcryptjs';
import db from './db.js';

db.prepare(`
  INSERT INTO admins (email, password)
  VALUES (?, ?)
`).run(
  'admin@test.com',
  bcrypt.hashSync('123456', 10)
);

console.log('Admin created');


