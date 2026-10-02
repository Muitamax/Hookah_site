const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const { createMailer } = require('./lib/mailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'hookah-store-secret';
const DB_HOST = process.env.MYSQLHOST || process.env.MYSQL_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306);
const DB_USER = process.env.MYSQLUSER || process.env.MYSQL_USER || 'hookahapp';
const DB_PASSWORD = process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || 'hookahpass';
const DB_NAME = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'hookah_store';
const SITE_NAME = process.env.APP_NAME || 'Hookah Store';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@hookah.store';
const mailer = createMailer();

console.log('[DB Config] Host:', DB_HOST, 'Port:', DB_PORT, 'DB:', DB_NAME);

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelayMs: 0,
});

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3001', 'http://localhost:3000', 'http://127.0.0.1:3001',
      'https://muitamax.github.io', 'https://hookah-store-api.render.com',
      'https://hookahsite-production.up.railway.app',
      process.env.APP_URL, process.env.FRONTEND_URL,
    ].filter(Boolean);
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 120 }));

app.use(async (req, res, next) => {
  req.user = null;
  const token = (req.headers.authorization || '').slice(7);
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const [rows] = await pool.query('SELECT id, name, email, role, loyalty_points, is_verified FROM users WHERE id = ?', [decoded.id]);
      if (rows[0]) req.user = rows[0];
    } catch (e) {}
  }
  next();
});

app.use((req, res, next) => {
  res.on('finish', async () => {
    try {
      await pool.query('INSERT INTO access_logs (user_id, path, method, status_code, ip_address) VALUES (?, ?, ?, ?, ?)',
        [req.user ? req.user.id : null, req.path, req.method, res.statusCode, req.ip]);
    } catch (e) {}
  });
  next();
});

function hashPassword(password) { return bcrypt.hashSync(password, 10); }
function comparePassword(password, hash) { return bcrypt.compareSync(password, hash); }
function createToken(user) { return jwt.sign({ id: user.id, email: user.email, role: user.role, loyaltyPoints: user.loyalty_points || 0 }, JWT_SECRET, { expiresIn: '7d' }); }
function hashValue(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function createResetToken() { return crypto.randomBytes(24).toString('hex'); }
function createVerificationToken() { return crypto.randomBytes(24).toString('hex'); }
function getVerificationBaseUrl() { return 'https://hookahsite-production.up.railway.app'; }
function createVerificationUrl(token, email) { const base = getVerificationBaseUrl(); return `${base}/account.html?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&action=verify`; }
function createResetUrl(token, email) { const base = getVerificationBaseUrl(); return `${base}/account.html?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&action=reset`; }
function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, verification_token_hash, verification_token_expires_at, reset_token_hash, reset_token_expires_at, ...rest } = user;
  return { ...rest, isVerified: Boolean(user.is_verified) };
}
function requireAuth(req, res, next) { if (!req.user) return res.status(401).json({ message: 'Authentication required' }); next(); }
function requireRoles(...roles) { return (req, res, next) => { if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' }); next(); }; }

async function initializeDatabase() {
  console.log('[DB Init] Starting...');
  try {
    const bootstrap = mysql.createPool({ host: DB_HOST, port: DB_PORT, user: DB_USER, password: DB_PASSWORD, connectionLimit: 2 });
    console.log('[DB Init] Creating database...');
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await bootstrap.end();

    console.log('[DB Init] Creating tables...');
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120), email VARCHAR(120) UNIQUE, password_hash VARCHAR(255), role VARCHAR(30) DEFAULT 'customer', loyalty_points INT DEFAULT 0, is_verified TINYINT DEFAULT 0, verification_token_hash VARCHAR(255), verification_token_expires_at TIMESTAMP NULL, reset_token_hash VARCHAR(255), reset_token_expires_at TIMESTAMP NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS products (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(160), description TEXT, price DECIMAL(10,2), image VARCHAR(255), badge VARCHAR(80), category VARCHAR(40) DEFAULT 'flavor', is_active TINYINT DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS orders (id INT AUTO_INCREMENT PRIMARY KEY, order_number VARCHAR(80) UNIQUE, user_id INT, customer_name VARCHAR(120), phone VARCHAR(40), address TEXT, payment_method VARCHAR(40), notes TEXT, items JSON, rental JSON, subtotal DECIMAL(10,2), delivery_fee DECIMAL(10,2), rental_fee DECIMAL(10,2) DEFAULT 0, total DECIMAL(10,2), status VARCHAR(40) DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS access_logs (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, path VARCHAR(255), method VARCHAR(20), status_code INT, ip_address VARCHAR(64), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    const [productCount] = await pool.query('SELECT COUNT(*) AS count FROM products');
    if (productCount[0].count === 0) {
      console.log('[DB Init] Inserting products...');
      await pool.query(`INSERT INTO products (name, description, price, image, badge, category) VALUES
        ('Blueberry Mint', 'Cool mint with berry sweetness', 3200, '/images/blueberry.jpg', 'Bestseller', 'flavor'),
        ('Magic Love', 'Lush fruit blend', 2900, '/images/magic.jpg', 'New', 'flavor'),
        ('Mint Flavour', 'Fresh crisp mint', 3100, '/images/mint.jpg', 'Limited', 'flavor'),
        ('Orange', 'Bright citrus', 2800, '/images/orange.jpg', 'Classic', 'flavor'),
        ('Two Apples', 'Classic apple blend', 3000, '/images/apples.jpg', 'Fan Favorite', 'flavor'),
        ('Shisha Pot Set', 'Premium glass pot', 6500, '/Hookah%204.png', 'Accessory', 'pot')`);
    }

    const [userCount] = await pool.query('SELECT COUNT(*) AS count FROM users');
    if (userCount[0].count === 0) {
      console.log('[DB Init] Creating default users...');
      await pool.query('INSERT INTO users (name, email, password_hash, role, is_verified) VALUES (?, ?, ?, ?, 1), (?, ?, ?, ?, 1)',
        ['Admin User', 'admin@hookah.store', hashPassword('Admin123!'), 'admin', 'Sales User', 'sales@hookah.store', hashPassword('Sales123!'), 'sales']);
    }

    console.log('[DB Init] ✓ Complete');
    return true;
  } catch (error) {
    console.error('[DB Init] ✗ Error:', error.message);
    return false;
  }
}

let dbReady = false;
initializeDatabase().then(success => { dbReady = success; });

app.get('/health', (req, res) => res.json({ status: 'ok', database: dbReady }));
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, description, price, image, badge FROM products WHERE is_active = 1');
    res.json({ products: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/products', requireAuth, requireRoles('admin'), async (req, res) => {
  const { name, description, price, image, category } = req.body;
  const [result] = await pool.query('INSERT INTO products (name, description, price, image, category) VALUES (?, ?, ?, ?, ?)', [name, description, price, image || '/Hookah%204.png', category || 'flavor']);
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
  res.status(201).json({ product: rows[0] });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Required fields missing' });

  const verificationToken = createVerificationToken();
  const [result] = await pool.query('INSERT INTO users (name, email, password_hash, verification_token_hash, verification_token_expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
    [name, email.toLowerCase(), hashPassword(password), hashValue(verificationToken)]);
  const [rows] = await pool.query('SELECT id, name, email, role, is_verified FROM users WHERE id = ?', [result.insertId]);
  const user = rows[0];

  try {
    const verificationUrl = createVerificationUrl(verificationToken, user.email);
    await mailer.sendVerificationEmail({ to: user.email, name: user.name, verificationUrl });
  } catch (error) {
    console.error('Email error:', error.message);
  }

  res.status(201).json({ user: sanitizeUser(user), message: 'Account created. Check email to verify.' });
});

app.get('/api/auth/verify-email', async (req, res) => {
  const { email, token } = req.query;
  if (!email || !token) return res.redirect('/account.html?message=' + encodeURIComponent('Invalid link'));

  const [rows] = await pool.query('SELECT id, is_verified, verification_token_hash, verification_token_expires_at FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!rows[0]) return res.redirect('/account.html?message=' + encodeURIComponent('User not found'));
  if (rows[0].is_verified) return res.redirect('/my-account.html?message=' + encodeURIComponent('Already verified'));

  const expiresAt = new Date(rows[0].verification_token_expires_at);
  if (!rows[0].verification_token_hash || expiresAt <= new Date()) return res.redirect('/account.html?message=' + encodeURIComponent('Link expired'));

  if (hashValue(token) !== rows[0].verification_token_hash) return res.redirect('/account.html?message=' + encodeURIComponent('Invalid link'));

  await pool.query('UPDATE users SET is_verified = 1, verification_token_hash = NULL WHERE id = ?', [rows[0].id]);
  res.redirect('/my-account.html?message=' + encodeURIComponent('Email verified. Sign in now.'));
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.query('SELECT id, name, email, password_hash, role, loyalty_points, is_verified FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!rows[0] || !comparePassword(password, rows[0].password_hash)) return res.status(401).json({ message: 'Invalid credentials' });
  if (!rows[0].is_verified) return res.status(403).json({ message: 'Verify email first' });

  res.json({ user: sanitizeUser(rows[0]), token: createToken(rows[0]) });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: sanitizeUser(req.user) }));

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  const [rows] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [email.toLowerCase()]);
  if (rows[0]) {
    const resetToken = createResetToken();
    await pool.query('UPDATE users SET reset_token_hash = ?, reset_token_expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?', [hashValue(resetToken), rows[0].id]);
    try {
      const resetUrl = createResetUrl(resetToken, rows[0].email);
      await mailer.sendPasswordResetEmail({ to: rows[0].email, name: rows[0].name, resetUrl });
    } catch (error) {
      console.error('Email error:', error.message);
    }
  }
  res.json({ message: 'If account exists, reset link sent' });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, token, password } = req.body;
  const [rows] = await pool.query('SELECT id, email, reset_token_hash, reset_token_expires_at FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!rows[0] || !rows[0].reset_token_hash || new Date(rows[0].reset_token_expires_at) <= new Date()) return res.status(400).json({ message: 'Invalid or expired' });
  if (hashValue(token) !== rows[0].reset_token_hash) return res.status(400).json({ message: 'Invalid token' });

  await pool.query('UPDATE users SET password_hash = ?, is_verified = 1, reset_token_hash = NULL WHERE id = ?', [hashPassword(password), rows[0].id]);
  const [updated] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ?', [rows[0].id]);
  res.json({ message: 'Password updated', user: sanitizeUser(updated[0]), token: createToken(updated[0]) });
});

app.get('/api/orders', requireAuth, async (req, res) => {
  if (req.user.role === 'admin') {
    const [rows] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    return res.json({ orders: rows });
  }
  const [rows] = await pool.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json({ orders: rows });
});

app.post('/api/orders', requireAuth, async (req, res) => {
  const { name, phone, address, paymentMethod, items, rental, notes } = req.body;
  if (!name || !phone || !address || !items || !items.length) return res.status(400).json({ message: 'Missing fields' });

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = 300;
  const rentalFee = rental?.enabled ? (rental.nights * rental.amount) : 0;
  const total = subtotal + deliveryFee + rentalFee;
  const orderNumber = `HS-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const [result] = await pool.query('INSERT INTO orders (order_number, user_id, customer_name, phone, address, payment_method, notes, items, rental, subtotal, delivery_fee, rental_fee, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [orderNumber, req.user.id, name, phone, address, paymentMethod, notes || '', JSON.stringify(items), JSON.stringify(rental || {}), subtotal, deliveryFee, rentalFee, total]);

  await pool.query('UPDATE users SET loyalty_points = loyalty_points + 10 WHERE id = ?', [req.user.id]);

  try {
    await mailer.sendOrderConfirmationEmail({ to: req.user.email, name: req.user.name, order: { orderNumber, customerName: name, phone, address, paymentMethod, notes, items, subtotal, deliveryFee, rentalFee, total } });
  } catch (error) {
    console.error('Email error:', error.message);
  }

  res.status(201).json({ order: { id: result.insertId, orderNumber, total, status: 'pending' }, message: 'Order created' });
});

app.listen(PORT, () => {
  console.log(`\n✓ Hookah Store online at https://hookahsite-production.up.railway.app`);
});

