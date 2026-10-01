# Shisha Store - Local Setup & GitHub Deployment Guide

## 📋 Project Overview
- **Name**: Hookah Store
- **Type**: Node.js + Express Backend + Vanilla JS Frontend
- **Database**: MySQL/MariaDB
- **Port**: 3001 (local)
- **Production**: Ready for deployment

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js (v14+) - [Install](https://nodejs.org/)
- MySQL/MariaDB - [Install](https://mariadb.org/download/)
- Git

### Step 1: Clone Repository
```bash
git clone https://github.com/YOUR_USERNAME/Shisha_site.git
cd Shisha_site
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Database Configuration
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=hookahapp
MYSQL_PASSWORD=hookahpass
MYSQL_DATABASE=hookah_store

# Server Configuration
NODE_ENV=development
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-in-production
APP_URL=http://localhost:3001
APP_NAME=Hookah Store

# Email Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

**⚠️ Important**: Get Google App Password:
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer"
3. Copy the 16-character password to `SMTP_PASS`

### Step 4: Set Up Database User
```bash
sudo mysql << 'EOF'
CREATE USER IF NOT EXISTS 'hookahapp'@'localhost' IDENTIFIED BY 'hookahpass';
GRANT ALL PRIVILEGES ON hookah_store.* TO 'hookahapp'@'localhost';
FLUSH PRIVILEGES;
EOF
```

### Step 5: Start the Server
```bash
npm start
```

✅ Server will start on **http://localhost:3001**

Database tables auto-create on first run.

---

## ✅ Testing All Routes & Redirects

### Frontend Routes (All serve `public/index.html`)
- `http://localhost:3001/` - Home page
- `http://localhost:3001/account.html` - Login/Register
- `http://localhost:3001/my-account.html` - User Dashboard
- `http://localhost:3001/admin.html` - Admin Panel (admin only)
- `http://localhost:3001/sales.html` - Sales Dashboard (sales/admin)
- `http://localhost:3001/dashboard-nav.html` - Dashboard Navigation

### API Routes

**Health Check**
```bash
curl http://localhost:3001/health
```
Response: `{"status":"ok","service":"hookah-store","database":"mysql"}`

**Products**
```bash
# Get all products
curl http://localhost:3001/api/products

# Add product (admin only)
curl -X POST http://localhost:3001/api/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Flavor Name",
    "description": "Description",
    "price": 1500,
    "category": "flavor",
    "image": "/Hookah%204.png"
  }'
```

**Authentication**
```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Get current user
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Forgot password
curl -X POST http://localhost:3001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com"}'

# Reset password
curl -X POST http://localhost:3001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "token": "RESET_TOKEN",
    "password": "newpassword123"
  }'
```

**Orders**
```bash
# Get user orders
curl http://localhost:3001/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create order
curl -X POST http://localhost:3001/api/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"product_id": 1, "quantity": 2}],
    "total": 3300,
    "delivery_date": "2026-10-05",
    "delivery_time": "18:00"
  }'
```

**Admin Features**
```bash
# Get all users (admin only)
curl http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Get access logs (admin only)
curl http://localhost:3001/api/admin/access-logs \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Get activity logs (admin only)
curl http://localhost:3001/api/logs \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Send site report (admin only)
curl -X POST http://localhost:3001/api/admin/send-site-report \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## 🔗 Email Verification & Password Reset Flow

### Email Verification
1. User registers via `/api/auth/register`
2. Verification email sent to user
3. User clicks link: `/api/auth/verify-email?token=xxx&email=xxx`
4. Redirects to `/my-account.html?verified=1`

### Password Reset
1. User requests reset via `/api/auth/forgot-password`
2. Reset email sent with link
3. User clicks link → redirected to `/account.html?token=xxx&email=xxx`
4. User submits new password to `/api/auth/reset-password`
5. Redirects to login page

---

## 📦 Deploy to GitHub

### Step 1: Create GitHub Repository
1. Go to https://github.com/new
2. Create repository `Shisha_site` (public or private)
3. **DO NOT** add README, .gitignore, or license (we have them)

### Step 2: Add GitHub Remote
```bash
cd /home/muruthi/Shisha_site

# Remove GitLab remote
git remote remove origin

# Add GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/Shisha_site.git

# Verify
git remote -v
```

### Step 3: Commit and Push Changes
```bash
# Add all changes
git add .

# Commit
git commit -m "Initial commit: Shisha Store e-commerce platform

- Express.js backend with JWT authentication
- MySQL database with auto-initialization
- User registration & email verification
- Password reset functionality
- Shopping cart and order management
- Admin dashboard and sales tracking
- Rate limiting and security hardening"

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## 🌐 Production Deployment

### Option A: Heroku (Free tier)

```bash
# Install Heroku CLI
curl https://cli.heroku.com/install.sh | sh

# Login
heroku login

# Create app
heroku create hookah-store

# Set environment variables
heroku config:set \
  NODE_ENV=production \
  JWT_SECRET=your-long-random-secret-key \
  APP_URL=https://hookah-store.herokuapp.com \
  SMTP_HOST=smtp.gmail.com \
  SMTP_PORT=465 \
  SMTP_SECURE=true \
  SMTP_USER=your-email@gmail.com \
  SMTP_PASS=your-app-password

# Add MySQL addon
heroku addons:create cleardb:ignite

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Option B: AWS EC2

```bash
# On EC2 instance:
sudo apt update && sudo apt install -y nodejs npm mysql-server

# Clone repo
git clone https://github.com/YOUR_USERNAME/Shisha_site.git
cd Shisha_site

# Install & build
npm install

# Set environment variables
cat > .env << 'EOF'
NODE_ENV=production
PORT=3001
JWT_SECRET=your-secret-key
APP_URL=https://yourdomain.com
# ... other vars
EOF

# Start with PM2 (recommended)
npm install -g pm2
pm2 start server.js --name "hookah-store"
pm2 startup
pm2 save
```

### Option C: DigitalOcean App Platform

1. Push code to GitHub
2. Go to https://cloud.digitalocean.com/apps
3. Click "Create" → "App"
4. Select GitHub repo
5. Configure:
   - Build command: `npm install`
   - Run command: `npm start`
   - Environment: Set all `.env` variables
   - Resources: Connect MySQL database
6. Deploy

---

## 🔐 Security Checklist

- [ ] Change `JWT_SECRET` to a long random string (30+ chars)
- [ ] Use Gmail App Password (not regular password)
- [ ] Set `NODE_ENV=production` on server
- [ ] Use HTTPS only in production
- [ ] Enable database backups
- [ ] Set rate limiting in production
- [ ] Don't commit `.env` file
- [ ] Use environment variables for all secrets
- [ ] Enable CORS only for your domain
- [ ] Use strong password requirements

---

## 🧪 Run Tests

```bash
npm test
```

Tests included for:
- Authentication & redirects
- Email verification
- Password reset
- Mailer service

---

## 📊 Project Structure

```
Shisha_site/
├── server.js              # Express server & API routes
├── package.json           # Dependencies
├── .env                   # Environment variables (SECRET - don't commit)
├── .gitignore             # Files to ignore in Git
│
├── lib/
│   └── mailer.js          # Email service
│
├── public/                # Frontend files
│   ├── index.html         # Home page
│   ├── account.html       # Login/Register
│   ├── my-account.html    # User dashboard
│   ├── admin.html         # Admin panel
│   ├── sales.html         # Sales dashboard
│   ├── app.js             # Main app logic
│   ├── account.js         # Auth forms logic
│   ├── admin.js           # Admin features
│   ├── sales.js           # Sales features
│   ├── auth-redirect.js   # Post-auth redirect handler
│   └── styles.css         # Styling
│
├── images/                # Product images
│
├── tests/                 # Test files
│   ├── auth-redirect.test.js
│   ├── forgot-password.test.js
│   └── mailer.test.js
│
└── data/                  # Data files (images, etc)
```

---

## 🆘 Troubleshooting

### "Cannot connect to MySQL"
```bash
# Start MySQL
sudo systemctl start mysql

# Check if running
sudo systemctl status mysql
```

### "Port 3001 already in use"
```bash
# Kill process on port 3001
sudo lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Or use different port
PORT=3002 npm start
```

### "Email not sending"
- Check SMTP credentials in `.env`
- Gmail requires App Password (not regular password)
- Enable "Less secure apps" if using old Gmail account
- Check spam/junk folder

### "Database tables not created"
```bash
# Check table creation:
mysql -u hookahapp -p hookah_store -e "SHOW TABLES;"

# Restart server to trigger auto-initialization
npm start
```

---

## 📞 Support & Next Steps

1. **Test all links** at http://localhost:3001
2. **Create a test account** to verify email
3. **Place a test order** to verify checkout flow
4. **Push to GitHub** using steps above
5. **Deploy to production** using Option A, B, or C
6. **Update APP_URL** in `.env` to your production domain

---

**Happy coding! 🚀**
