import jwt from 'jsonwebtoken';

export const adminAuth1 = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });

  const token = header.split(' ')[1];
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
export const adminAuth = (req, res, next) => {
  console.log('AUTH HEADER =>', req.headers.authorization);

  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });

  const token = header.split(' ')[1];

  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    console.error('JWT VERIFY ERROR =>', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};