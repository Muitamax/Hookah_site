# Frontend Configuration Guide

## Overview

The Shisha Store frontend is built with **Vanilla JavaScript** (no framework). It communicates with the backend API using the `config.js` file which provides:

1. **API Configuration** - Base URLs and endpoint definitions
2. **Authentication Helper** - Token and user management
3. **API Helper** - Simplified fetch wrapper with auth
4. **Storage Helper** - LocalStorage management for cart

---

## 📋 How It Works

### 1. Configuration File (`public/config.js`)

The frontend uses a centralized configuration:

```javascript
// API Base URL (empty string = same domain)
CONFIG.API_BASE_URL = ''

// API Endpoints
CONFIG.API_ENDPOINTS.PRODUCTS = '/api/products'
CONFIG.API_ENDPOINTS.AUTH.LOGIN = '/api/auth/login'
// ... etc
```

**Note**: Since frontend and backend are on the **same domain** (`localhost:3001`), we use **relative URLs** (`/api/...`) instead of full URLs.

---

## 🔐 Authentication Flow

### Storing Token & User

After login, the app stores:
```javascript
localStorage.setItem('hookahToken', token)        // JWT token
localStorage.setItem('hookahUser', user_object)   // User data
```

### Using Token in Requests

All API requests automatically include the token:

```javascript
// This automatically adds Authorization header
const user = await ApiHelper.get('/api/auth/me')
```

### Logout

```javascript
AuthHelper.clearAuthData()  // Removes token & user from localStorage
```

---

## 🎯 Usage Examples

### Initialize Frontend on Page Load

```html
<!-- Include config first -->
<script src="/config.js"></script>
<script src="/app.js"></script>
```

### Load Products

```javascript
async function loadProducts() {
  try {
    const data = await ApiHelper.get(CONFIG.API_ENDPOINTS.PRODUCTS)
    console.log(data.products)
  } catch (error) {
    console.error('Error loading products:', error.message)
  }
}
```

### Register User

```javascript
async function register(name, email, password) {
  try {
    const response = await ApiHelper.post(
      CONFIG.API_ENDPOINTS.AUTH.REGISTER,
      { name, email, password }
    )
    console.log('Account created:', response.user)
  } catch (error) {
    console.error('Registration failed:', error.message)
  }
}
```

### Login User

```javascript
async function login(email, password) {
  try {
    const response = await ApiHelper.post(
      CONFIG.API_ENDPOINTS.AUTH.LOGIN,
      { email, password }
    )
    // Save auth data
    AuthHelper.setAuthData(response.token, response.user)
    console.log('Logged in as:', response.user.email)
  } catch (error) {
    console.error('Login failed:', error.message)
  }
}
```

### Get Current User

```javascript
async function getCurrentUser() {
  try {
    // First check localStorage
    let user = AuthHelper.getUser()
    
    // If token exists, fetch fresh user data
    if (AuthHelper.isAuthenticated()) {
      const response = await ApiHelper.get(CONFIG.API_ENDPOINTS.AUTH.ME)
      user = response.user
    }
    
    return user
  } catch (error) {
    console.error('Error getting user:', error.message)
    return null
  }
}
```

### Check User Permissions

```javascript
// Check if user is logged in
if (AuthHelper.isAuthenticated()) {
  console.log('User is logged in')
}

// Check if user is admin
if (AuthHelper.isAdmin()) {
  console.log('Show admin panel')
}

// Check if user is sales
if (AuthHelper.isSales()) {
  console.log('Show sales dashboard')
}
```

### Get/Set Cart

```javascript
// Load cart
const cart = StorageHelper.getCart()

// Save cart
StorageHelper.setCart([
  { id: 1, name: 'Blueberry Mint', price: 700, quantity: 2 },
  { id: 2, name: 'Magic Love', price: 900, quantity: 1 }
])

// Clear cart
StorageHelper.clearCart()
```

### Create Order

```javascript
async function createOrder(items, total, deliveryDate, deliveryTime) {
  try {
    if (!AuthHelper.isAuthenticated()) {
      throw new Error('Please login to place order')
    }

    const response = await ApiHelper.post(
      CONFIG.API_ENDPOINTS.ORDERS.CREATE,
      {
        items,
        total,
        delivery_date: deliveryDate,
        delivery_time: deliveryTime
      }
    )
    
    console.log('Order created:', response.order)
    StorageHelper.clearCart()  // Clear cart after successful order
    return response.order
  } catch (error) {
    console.error('Order failed:', error.message)
  }
}
```

---

## 🌐 Environment-Specific Configuration

### Local Development
```javascript
// Uses relative URLs (/api/*)
CONFIG.API_BASE_URL = ''
CONFIG.SITE_URL = 'http://localhost:3001'
```

### Production
Update `config.js` for CORS:
```javascript
const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return 'https://yourdomain.com'  // Full URL for CORS
  }
  return ''  // Relative URLs for same-origin
}
```

---

## 🔒 Security Notes

### ✅ Safe Public Information in Browser
- Product data
- User names & emails
- App name & version
- Delivery zones
- API endpoint paths

### ❌ Never Put in Browser Config
- API keys
- Database credentials
- Admin tokens
- Secrets
- Private user data (stored server-side)

### Token Management
- Tokens stored in `localStorage` (not `sessionStorage` for persistence)
- Tokens auto-included in all authenticated requests
- Tokens removed on logout
- 7-day expiration (set server-side)

---

## 📱 Multiple Page Support

Each page can import and use the same config:

**account.html** (Login/Register)
```html
<script src="/config.js"></script>
<script>
  // Use AuthHelper and ApiHelper for login
  async function handleLogin(email, password) {
    const response = await ApiHelper.post(
      CONFIG.API_ENDPOINTS.AUTH.LOGIN,
      { email, password }
    )
    AuthHelper.setAuthData(response.token, response.user)
    window.location = '/my-account.html'
  }
</script>
```

**my-account.html** (User Dashboard)
```html
<script src="/config.js"></script>
<script>
  // Check auth status
  if (!AuthHelper.isAuthenticated()) {
    window.location = '/account.html'
  }
  
  // Load user orders
  const orders = await ApiHelper.get(CONFIG.API_ENDPOINTS.ORDERS.LIST)
</script>
```

**admin.html** (Admin Panel)
```html
<script src="/config.js"></script>
<script>
  // Check admin permission
  if (!AuthHelper.isAdmin()) {
    window.location = '/'
  }
  
  // Load admin data
  const users = await ApiHelper.get(CONFIG.API_ENDPOINTS.ADMIN.USERS)
</script>
```

---

## 🧪 Testing Frontend Locally

### Open Browser Console
Press `F12` or `Ctrl+Shift+I` → Console tab

### Test Config Loading
```javascript
console.log(CONFIG)
```

### Test API Call
```javascript
ApiHelper.get('/api/products')
  .then(data => console.log(data))
  .catch(err => console.error(err))
```

### Test Auth
```javascript
AuthHelper.setAuthData('test-token', { email: 'test@test.com', role: 'customer' })
AuthHelper.getToken()           // Returns token
AuthHelper.getUser()            // Returns user
AuthHelper.isAuthenticated()    // Returns true
```

---

## 🚀 Deploying to Production

### 1. Update config.js
```javascript
const getApiBaseUrl = () => {
  // Production: use full URL
  if (window.location.hostname !== 'localhost') {
    return window.location.origin
  }
  return ''
}
```

### 2. Update .env
```env
APP_URL=https://yourdomain.com
SITE_URL=https://yourdomain.com
```

### 3. Enable CORS (if frontend on different domain)
```javascript
// server.js already has:
app.use(cors())  // Allows all origins

// For production, restrict to your domain:
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true
}))
```

---

## 📊 Frontend File Structure

```
public/
├── index.html          # Homepage
├── account.html        # Login/Register page
├── my-account.html     # User dashboard
├── admin.html          # Admin panel
├── sales.html          # Sales dashboard
│
├── config.js           # Frontend configuration (PUBLIC)
├── app.js              # Homepage logic
├── account.js          # Auth logic
├── admin.js            # Admin features
├── sales.js            # Sales features
├── auth-redirect.js    # Post-auth redirect handler
├── dashboard-nav.js    # Navigation logic
│
└── styles.css          # Styling
```

---

## ❓ Troubleshooting

### "API is undefined"
Make sure `config.js` is loaded BEFORE other scripts:
```html
<script src="/config.js"></script>
<script src="/app.js"></script>
```

### "Cannot read localStorage"
Check if you're in private/incognito mode. Some browsers restrict localStorage.

### "401 Unauthorized"
Token expired or invalid. User needs to login again:
```javascript
if (response.status === 401) {
  AuthHelper.clearAuthData()
  window.location = '/account.html'
}
```

### "CORS error"
Frontend and backend on different domains. Update `.env`:
```env
CORS_ORIGIN=https://yourdomain.com
```

---

## ✨ Summary

The frontend is fully configured and ready to use:

1. ✅ **config.js** - Centralized configuration
2. ✅ **ApiHelper** - Simplified API calls
3. ✅ **AuthHelper** - Authentication management
4. ✅ **StorageHelper** - LocalStorage management
5. ✅ **Multi-page app** - All pages share same config

**No changes needed for local development!** Just visit http://localhost:3001
