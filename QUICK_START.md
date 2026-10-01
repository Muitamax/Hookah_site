# ⚡ Quick Start Guide

## 30 Seconds: Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env with your config
nano .env

# 4. Start server
npm start
```

✅ Visit http://localhost:3001

---

## 5 Minutes: Push to GitHub

```bash
# 1. Create repo on GitHub at github.com/new

# 2. Add GitHub remote
git remote set-url origin https://github.com/YOUR_USERNAME/Shisha_site.git

# 3. Push code
git add .
git commit -m "Deploy to GitHub"
git push origin main
```

✅ Your code is on GitHub!

---

## Key Links
- **Local**: http://localhost:3001
- **API Health**: http://localhost:3001/health
- **Products API**: http://localhost:3001/api/products
- **Full Guide**: See `DEPLOYMENT_GUIDE.md`

---

## Database Setup
```bash
sudo mysql << 'EOF'
CREATE USER IF NOT EXISTS 'hookahapp'@'localhost' IDENTIFIED BY 'hookahpass';
GRANT ALL PRIVILEGES ON hookah_store.* TO 'hookahapp'@'localhost';
FLUSH PRIVILEGES;
EOF
```

---

## Environment Variables Required
```env
MYSQL_HOST=127.0.0.1
MYSQL_USER=hookahapp
MYSQL_PASSWORD=hookahpass
MYSQL_DATABASE=hookah_store
PORT=3001
JWT_SECRET=your-secret-key
APP_URL=http://localhost:3001
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

---

## Test Account
After running the server, register at http://localhost:3001/account.html

---

**Need help?** See `DEPLOYMENT_GUIDE.md` for detailed instructions.
