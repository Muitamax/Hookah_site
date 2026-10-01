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


**Happy coding! 🚀**
