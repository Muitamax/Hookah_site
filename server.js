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
const DB_HOST = process.env.MYSQL_HOST || '127.0.0.1';
const DB_PORT = Number(process.env.MYSQL_PORT || 3306);
const DB_USER = process.env.MYSQL_USER || 'hookahapp';
const DB_PASSWORD = process.env.MYSQL_PASSWORD || 'hookahpass';
const DB_NAME = process.env.MYSQL_DATABASE || 'hookah_store';
const SITE_NAME = process.env.APP_NAME || 'Hookah Store';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.MAIL_TO || process.env.SMTP_USER || 'admin@hookah.store';
const mailer = createMailer();

function isSafeAppUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    return !hostname.includes('ngrok');
  } catch (error) {
    return false;
  }
}

function getAppUrl() {
  require('dotenv').config({ override: true });
  const configured = process.env.APP_URL || process.env.BASE_URL;
  if (isSafeAppUrl(configured)) {
    return configured;
  }
  return `http://localhost:${PORT}`;
}

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

app.use(helmet());

// Configure CORS for different environments
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3001',
  'https://muitamax.github.io',
  'https://hookah-store-api.render.com',
  process.env.APP_URL,
  process.env.FRONTEND_URL,
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }));

app.use(async (req, res, next) => {
  req.user = null;
  req.userId = null;
  req.profile = null;

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const [rows] = await pool.query('SELECT id, name, email, role, loyalty_points, is_verified, created_at FROM users WHERE id = ?', [decoded.id]);
      if (rows[0]) {
        req.user = rows[0];
        req.userId = rows[0].id;
        req.profile = rows[0];
      }
    } catch (error) {
      // ignore bad tokens, treat as unauthenticated request
    }
  }
  next();
});

app.use((req, res, next) => {
  res.on('finish', async () => {
    try {
      await pool.query(
        'INSERT INTO access_logs (user_id, path, method, status_code, ip_address) VALUES (?, ?, ?, ?, ?)',
        [req.user ? req.user.id : null, req.path, req.method, res.statusCode, req.ip]
      );
    } catch (error) {
      // keep the app responsive even if logging fails
    }
  });
  next();
});

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, loyaltyPoints: user.loyalty_points || 0 }, JWT_SECRET, { expiresIn: '7d' });
}

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createResetToken() {
  return crypto.randomBytes(24).toString('hex');
}

function createVerificationToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getVerificationBaseUrl() {
  // For production on GitHub Pages
  if (process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL
  }
  // For production on Render (fallback)
  if (process.env.NODE_ENV === 'production') {
    return 'https://muitamax.github.io/Hookah_site'
  }
  // For development
  return getAppUrl()
}

function createVerificationUrl(token, email) {
  const baseUrl = getVerificationBaseUrl()
  return `${baseUrl}/account.html?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&action=verify`;
}

function createResetUrl(token, email) {
  const baseUrl = getVerificationBaseUrl()
  return `${baseUrl}/account.html?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&action=reset`;
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, loyalty_points, is_verified, verification_token_hash, verification_token_expires_at, reset_token_hash, reset_token_expires_at, ...rest } = user;
  return {
    ...rest,
    isVerified: Boolean(is_verified),
    is_verified: Boolean(is_verified),
    loyaltyPoints: Number(loyalty_points || 0),
    loyalty_points: Number(loyalty_points || 0),
  };
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Please login or register before checkout.' });
  }
  next();
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have access to this operation.' });
    }
    next();
  };
}

async function initializeDatabase() {
  const bootstrap = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await bootstrap.end();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(120) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(30) NOT NULL DEFAULT 'customer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(160) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        image VARCHAR(255),
        badge VARCHAR(80),
        category VARCHAR(40) DEFAULT 'flavor',
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_number VARCHAR(80) NOT NULL UNIQUE,
        user_id INT DEFAULT NULL,
        customer_name VARCHAR(120) NOT NULL,
        phone VARCHAR(40) NOT NULL,
        address TEXT NOT NULL,
        payment_method VARCHAR(40) NOT NULL,
        notes TEXT,
        items JSON NOT NULL,
        rental JSON,
        subtotal DECIMAL(10,2) NOT NULL,
        delivery_fee DECIMAL(10,2) NOT NULL,
        rental_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        total DECIMAL(10,2) NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        path VARCHAR(255) NOT NULL,
        method VARCHAR(20) NOT NULL,
        status_code INT NOT NULL,
        ip_address VARCHAR(64) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [loyaltyColumns] = await pool.query('SHOW COLUMNS FROM users LIKE ?', ['loyalty_points']);
    if (!loyaltyColumns.length) {
      await pool.query('ALTER TABLE users ADD COLUMN loyalty_points INT NOT NULL DEFAULT 0');
    }

    const [verifiedColumns] = await pool.query('SHOW COLUMNS FROM users LIKE ?', ['is_verified']);
    if (!verifiedColumns.length) {
      await pool.query('ALTER TABLE users ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0');
    }

    const [verifyTokenColumns] = await pool.query('SHOW COLUMNS FROM users LIKE ?', ['verification_token_hash']);
    if (!verifyTokenColumns.length) {
      await pool.query('ALTER TABLE users ADD COLUMN verification_token_hash VARCHAR(255) DEFAULT NULL');
      await pool.query('ALTER TABLE users ADD COLUMN verification_token_expires_at TIMESTAMP NULL DEFAULT NULL');
    }

    const [resetTokenColumns] = await pool.query('SHOW COLUMNS FROM users LIKE ?', ['reset_token_hash']);
    if (!resetTokenColumns.length) {
      await pool.query('ALTER TABLE users ADD COLUMN reset_token_hash VARCHAR(255) DEFAULT NULL');
      await pool.query('ALTER TABLE users ADD COLUMN reset_token_expires_at TIMESTAMP NULL DEFAULT NULL');
    }

    await pool.query('UPDATE users SET is_verified = 1 WHERE role IN ("admin", "sales") AND is_verified = 0');

    const [productCount] = await pool.query('SELECT COUNT(*) AS count FROM products');
    if (productCount[0].count === 0) {
      await pool.query(`
        INSERT INTO products (name, description, price, image, badge, category) VALUES
        ('Blueberry Mint', 'Cool mint layered with dark berry sweetness for a smooth finish.', 3200, '/images/Al%20Fakher%2050g%20-%20Blueberry%20Mint%20.jpg', 'Bestseller', 'flavor'),
        ('Magic Love', 'A lush fruit blend with playful sweetness and rich aroma.', 2900, '/images/Al%20Fakher%20Magic%20Love.jpg', 'New', 'flavor'),
        ('Mint Flavour', 'Fresh, crisp mint with a clean and cooling smoke profile.', 3100, '/images/Al%20Fakher%20Mint%20Flavour%20250g.jpg', 'Limited', 'flavor'),
        ('Orange', 'Bright citrus sparkle with a soft, juicy finish.', 2800, '/images/Al%20Fakher%20Orange%20flavor%20250g.jpg', 'Classic', 'flavor'),
        ('Two Apples', 'Classic apple notes with a balanced, mellow smoke.', 3000, '/images/Al%20Fakher%20Two%20Apples%20Shisha%20Flavour.jpg', 'Fan Favorite', 'flavor'),
        ('Shisha Pot Set', 'Premium glass pot and elegant setup for your lounge experience.', 6500, '/Hookah%204.png', 'Accessory', 'pot')
      `);
    }

    const [userCount] = await pool.query('SELECT COUNT(*) AS count FROM users');
    if (userCount[0].count === 0) {
      await pool.query('INSERT INTO users (name, email, password_hash, role, is_verified) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)', [
        'Admin User', 'admin@hookah.store', hashPassword('Admin123!'), 'admin', 1,
        'Sales User', 'sales@hookah.store', hashPassword('Sales123!'), 'sales', 1,
      ]);
    }
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    throw error;
  }
}

async function logEvent(type, message, userId = null) {
  try {
    await pool.query('INSERT INTO access_logs (user_id, path, method, status_code, ip_address) VALUES (?, ?, ?, ?, ?)', [userId, `/event/${type}`, 'SYSTEM', 200, 'system']);
  } catch (error) {
    // ignore logging errors for now
  }
}

initializeDatabase()
  .then(() => console.log('MySQL database ready'))
  .catch((error) => console.error('Failed to initialize database:', error.message));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'hookah-store', database: 'mysql' });
});

app.get('/api/products', async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, description, price, image, badge, category FROM products WHERE is_active = 1 ORDER BY id');
  res.json({ products: rows });
});

app.post('/api/products', requireAuth, requireRoles('admin'), async (req, res) => {
  const { name, description, price, image, category } = req.body;
  if (!name || !price) {
    return res.status(400).json({ message: 'Product name and price are required.' });
  }

  const [result] = await pool.query(
    'INSERT INTO products (name, description, price, image, badge, category) VALUES (?, ?, ?, ?, ?, ?)',
    [name, description || '', Number(price), image || '/Hookah%204.png', category === 'pot' ? 'Accessory' : 'New', category || 'flavor']
  );

  const [rows] = await pool.query('SELECT id, name, description, price, image, badge, category FROM products WHERE id = ?', [result.insertId]);
  await logEvent('product', `Added product ${name}`, req.user.id);
  res.status(201).json({ product: rows[0] });
});

app.put('/api/products/:id', requireAuth, requireRoles('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, description, price, image, category, badge, is_active } = req.body;
  const [rows] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
  if (!rows.length) {
    return res.status(404).json({ message: 'Product not found.' });
  }

  await pool.query(
    'UPDATE products SET name = COALESCE(?, name), description = COALESCE(?, description), price = COALESCE(?, price), image = COALESCE(?, image), badge = COALESCE(?, badge), category = COALESCE(?, category), is_active = COALESCE(?, is_active) WHERE id = ?',
    [name || null, description || null, price !== undefined ? Number(price) : null, image || null, badge || null, category || null, is_active !== undefined ? Number(is_active) : null, id]
  );

  const [updated] = await pool.query('SELECT id, name, description, price, image, badge, category FROM products WHERE id = ?', [id]);
  await logEvent('product', `Updated product ${id}`, req.user.id);
  res.json({ product: updated[0] });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (existing.length) {
    return res.status(409).json({ message: 'An account with that email already exists.' });
  }

  const verificationToken = createVerificationToken();
  const verificationTokenHash = hashValue(verificationToken);
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role, loyalty_points, is_verified, verification_token_hash, verification_token_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
    [name, email.toLowerCase(), hashPassword(password), 'customer', 0, 0, verificationTokenHash]
  );
  const [rows] = await pool.query('SELECT id, name, email, role, loyalty_points, is_verified, created_at FROM users WHERE id = ?', [result.insertId]);
  const user = rows[0];
  const verificationUrl = createVerificationUrl(verificationToken, user.email);
  try {
    await mailer.sendVerificationEmail({ to: user.email, name: user.name, verificationUrl });
  } catch (error) {
    console.error('Verification email failed:', error.message);
  }

  await logEvent('auth', `Registered user ${user.email}`, user.id);
  res.status(201).json({
    user: sanitizeUser(user),
    message: 'Account created. Check your email to verify your account before signing in.',
  });
});

app.get('/api/auth/verify-email', async (req, res) => {
  const { email, token } = req.query;
  if (!email || !token) {
    return res.redirect('/account.html?message=' + encodeURIComponent('This verification link is invalid.'));
  }

  const [rows] = await pool.query('SELECT id, email, verification_token_hash, verification_token_expires_at, is_verified FROM users WHERE email = ?', [String(email).toLowerCase()]);
  const user = rows[0];
  if (!user) {
    return res.redirect('/account.html?message=' + encodeURIComponent('We could not find that account.'));
  }

  if (user.is_verified) {
    return res.redirect('/my-account.html?verified=1&message=' + encodeURIComponent('Your email is already verified. You can sign in now.'));
  }

  const expiresAt = new Date(user.verification_token_expires_at);
  if (!user.verification_token_hash || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    return res.redirect('/account.html?message=' + encodeURIComponent('This verification link has expired. Please request a new one.'));
  }

  const tokenHash = hashValue(String(token));
  if (tokenHash !== user.verification_token_hash) {
    return res.redirect('/account.html?message=' + encodeURIComponent('This verification link is invalid.'));
  }

  await pool.query('UPDATE users SET is_verified = 1, verification_token_hash = NULL, verification_token_expires_at = NULL WHERE id = ?', [user.id]);
  await logEvent('auth', `Verified email for ${user.email}`, user.id);
  return res.redirect('/my-account.html?verified=1&message=' + encodeURIComponent('Email verified. You can sign in now.'));
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const [rows] = await pool.query('SELECT id, name, email, password_hash, role, loyalty_points, is_verified, created_at FROM users WHERE email = ?', [email.toLowerCase()]);
  const user = rows[0];
  if (!user || !comparePassword(password, user.password_hash)) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  if (!user.is_verified) {
    return res.status(403).json({ message: 'Please verify your email before signing in. Check your inbox for the confirmation link.' });
  }

  await logEvent('auth', `Logged in ${user.email}`, user.id);
  res.json({ user: sanitizeUser(user), token: createToken(user) });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  res.json({ user: sanitizeUser(req.user), profile: sanitizeUser(req.profile), userId: req.userId });
});

app.put('/api/auth/profile', requireAuth, async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ message: 'Name and email are required.' });
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email.toLowerCase(), req.user.id]);
  if (existing.length) {
    return res.status(409).json({ message: 'That email is already registered with another account.' });
  }

  await pool.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email.toLowerCase(), req.user.id]);
  const [updatedRows] = await pool.query('SELECT id, name, email, role, loyalty_points, is_verified, created_at FROM users WHERE id = ?', [req.user.id]);
  const updatedUser = updatedRows[0];
  await logEvent('auth', `Updated profile for ${updatedUser.email}`, req.user.id);
  res.json({ message: 'Profile updated successfully.', user: sanitizeUser(updatedUser), token: createToken(updatedUser) });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Please provide your email address.' });
  }

  const [rows] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [email.toLowerCase()]);
  if (rows[0]) {
    const resetToken = createResetToken();
    const tokenHash = hashValue(resetToken);
    await pool.query('UPDATE users SET reset_token_hash = ?, reset_token_expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?', [tokenHash, rows[0].id]);
    const resetUrl = createResetUrl(resetToken, rows[0].email);
    try {
      await mailer.sendPasswordResetEmail({ to: rows[0].email, name: rows[0].name, resetUrl });
    } catch (error) {
      console.error('Password reset email failed:', error.message);
    }
    await logEvent('auth', `Requested password reset for ${rows[0].email}`, rows[0].id);
    return res.json({ message: 'If that account exists, a password reset link has been sent to the email address.', resetToken });
  }

  return res.json({ message: 'If that account exists, a password reset link has been sent to the email address.' });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, token, password } = req.body;
  if (!email || !token || !password) {
    return res.status(400).json({ message: 'Email, reset token, and a new password are required.' });
  }

  const [rows] = await pool.query('SELECT id, email, reset_token_hash, reset_token_expires_at FROM users WHERE email = ?', [email.toLowerCase()]);
  const user = rows[0];
  if (!user || !user.reset_token_hash || !user.reset_token_expires_at) {
    return res.status(400).json({ message: 'This reset token is invalid or has already been used.' });
  }

  const expiresAt = new Date(user.reset_token_expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    return res.status(400).json({ message: 'This reset token has expired.' });
  }

  const tokenHash = hashValue(token);
  if (tokenHash !== user.reset_token_hash) {
    return res.status(400).json({ message: 'This reset token is invalid.' });
  }

  await pool.query('UPDATE users SET password_hash = ?, is_verified = 1, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = ?', [hashPassword(password), user.id]);
  await logEvent('auth', `Reset password for ${user.email}`, user.id);
  const [updatedRows] = await pool.query('SELECT id, name, email, role, loyalty_points, created_at FROM users WHERE id = ?', [user.id]);
  res.json({ message: 'Password updated successfully.', user: sanitizeUser(updatedRows[0]), token: createToken(updatedRows[0]) });
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
  if (!name || !phone || !address || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'Please complete the checkout form.' });
  }

  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const deliveryFee = 300;
  const rentalFee = rental?.enabled ? Number(rental.nights || 1) * Number(rental.amount || 1500) : 0;
  const total = subtotal + deliveryFee + rentalFee;
  const orderNumber = `HS-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const [existingOrders] = await pool.query('SELECT COUNT(*) AS count FROM orders WHERE user_id = ?', [req.user.id]);
  const hasPreviousOrders = Number(existingOrders[0].count) > 0;
  const pointsEarned = hasPreviousOrders ? 25 : 10;
  const orderData = {
    orderNumber,
    customerName: name,
    phone,
    address,
    paymentMethod,
    notes: notes || '',
    items,
    rental: rental || { enabled: false, nights: 1, amount: 1500 },
    subtotal,
    deliveryFee,
    rentalFee,
    total,
    status: 'pending',
  };

  const [result] = await pool.query(
    'INSERT INTO orders (order_number, user_id, customer_name, phone, address, payment_method, notes, items, rental, subtotal, delivery_fee, rental_fee, total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [orderNumber, req.user.id, name, phone, address, paymentMethod, notes || '', JSON.stringify(items), JSON.stringify(orderData.rental), subtotal, deliveryFee, rentalFee, total, 'pending']
  );

  await pool.query('UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?', [pointsEarned, req.user.id]);
  const [updatedUserRows] = await pool.query('SELECT id, name, email, role, loyalty_points, created_at FROM users WHERE id = ?', [req.user.id]);
  req.user = updatedUserRows[0];
  req.userId = req.user.id;
  req.profile = req.user;

  try {
    await mailer.sendOrderConfirmationEmail({
      to: req.user.email,
      name: req.user.name,
      order: { id: result.insertId, ...orderData },
    });

    await mailer.sendOrderNotificationEmail({
      to: ADMIN_EMAIL,
      order: { id: result.insertId, ...orderData },
      customerEmail: req.user.email,
      customerName: req.user.name,
    });
  } catch (error) {
    console.error('Order email failed:', error.message);
  }

  await logEvent('order', `Created order ${orderNumber}`, req.user.id);
  res.json({ success: true, orderNumber, total, deliveryFee, rentalFee, paymentMethod, user: sanitizeUser(req.user), profile: sanitizeUser(req.user), loyaltyPoints: Number(req.user.loyalty_points || 0), pointsEarned, message: 'Order received. We will confirm your delivery shortly.' });
});

app.patch('/api/orders/:id/status', requireAuth, requireRoles('admin', 'sales'), async (req, res) => {
  const { status } = req.body;
  const [rows] = await pool.query('SELECT id FROM orders WHERE id = ?', [req.params.id]);
  if (!rows.length) {
    return res.status(404).json({ message: 'Order not found.' });
  }

  await pool.query('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id]);
  await logEvent('order', `Updated order ${req.params.id} to ${status}`, req.user.id);
  const [updated] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  res.json({ order: updated[0] });
});

app.get('/api/admin/users', requireAuth, requireRoles('admin'), async (req, res) => {
  const [rows] = await pool.query('SELECT id, name, email, role, loyalty_points, created_at FROM users ORDER BY created_at DESC');
  res.json({ users: rows });
});

app.get('/api/admin/access-logs', requireAuth, requireRoles('admin'), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM access_logs ORDER BY created_at DESC LIMIT 50');
  res.json({ logs: rows });
});

app.get('/api/logs', requireAuth, requireRoles('admin'), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM access_logs ORDER BY created_at DESC LIMIT 100');
  res.json({ logs: rows });
});

app.post('/api/admin/send-site-report', requireAuth, requireRoles('admin'), async (req, res) => {
  const [userCountRows] = await pool.query('SELECT COUNT(*) AS count FROM users');
  const [verifiedUserRows] = await pool.query('SELECT COUNT(*) AS count FROM users WHERE is_verified = 1');
  const [orderCountRows] = await pool.query('SELECT COUNT(*) AS count FROM orders');
  const [pendingOrderRows] = await pool.query("SELECT COUNT(*) AS count FROM orders WHERE status = 'pending'");
  const [visitCountRows] = await pool.query('SELECT COUNT(*) AS count FROM access_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)');
  const [activeUserRows] = await pool.query('SELECT COUNT(DISTINCT user_id) AS count FROM access_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND user_id IS NOT NULL');

  const report = {
    users: Number(userCountRows[0].count || 0),
    verifiedUsers: Number(verifiedUserRows[0].count || 0),
    orders: Number(orderCountRows[0].count || 0),
    pendingOrders: Number(pendingOrderRows[0].count || 0),
    visits24h: Number(visitCountRows[0].count || 0),
    activeUsers24h: Number(activeUserRows[0].count || 0),
  };

  try {
    await mailer.sendSiteReportEmail({
      to: ADMIN_EMAIL,
      subject: `${SITE_NAME} activity report`,
      summary: report,
    });
    await logEvent('admin', 'Sent site report email', req.user.id);
    res.json({ success: true, message: 'Site report email sent to the administrator.', report });
  } catch (error) {
    console.error('Site report email failed:', error.message);
    res.status(500).json({ message: 'Site report email could not be sent.', report });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Hookah Store running on http://localhost:${PORT}`);
  });
}

module.exports = app;
