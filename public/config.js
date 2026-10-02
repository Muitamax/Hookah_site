/**
 * Frontend Configuration
 * Public configuration for browser-side code
 * 
 * These values are visible in the browser and should not contain secrets
 */

// Determine API base URL based on environment
const getApiBaseUrl = () => {
  // GitHub Pages
  if (window.location.hostname === 'muitamax.github.io') {
    return 'https://hookah-store-api.render.com'
  }
  
  // Railway production
  if (window.location.hostname === 'hookahsite-production.up.railway.app') {
    return ''  // Use relative URLs for same-origin
  }
  
  // Local development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return ''  // Use relative URLs for same-origin
  }
  
  // Default: use same origin (for other deployments)
  return ''\
};

const CONFIG = {
  // API Configuration
  API_BASE_URL: getApiBaseUrl(),
  API_ENDPOINTS: {
    PRODUCTS: '/api/products',
    AUTH: {
      REGISTER: '/api/auth/register',
      LOGIN: '/api/auth/login',
      ME: '/api/auth/me',
      PROFILE: '/api/auth/profile',
      VERIFY_EMAIL: '/api/auth/verify-email',
      FORGOT_PASSWORD: '/api/auth/forgot-password',
      RESET_PASSWORD: '/api/auth/reset-password',
    },
    ORDERS: {
      LIST: '/api/orders',
      CREATE: '/api/orders',
      UPDATE_STATUS: '/api/orders/:id/status',
    },
    ADMIN: {
      USERS: '/api/admin/users',
      ACCESS_LOGS: '/api/admin/access-logs',
      LOGS: '/api/logs',
      SEND_REPORT: '/api/admin/send-site-report',
    },
  },

  // Local Storage Keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'hookahToken',
    USER_DATA: 'hookahUser',
    CART: 'hookahCart',
  },

  // App Settings
  APP_NAME: 'Hookah Store',
  SITE_URL: window.location.origin || 'https://hookahsite-production.up.railway.app',
  DELIVERY_FEE: 300,
  
  // Auth Settings
  AUTH: {
    TOKEN_EXPIRY_DAYS: 7,
    VERIFICATION_EXPIRES_HOURS: 24,
    RESET_TOKEN_EXPIRES_HOURS: 1,
  },

  // Delivery Zones
  DELIVERY_ZONES: [
    'Makutano',
    'Meru',
    'Kambakia',
    'KEMU',
    'Giantune',
    'Gitimbeni',
  ],

  // Toast/Notification Settings
  NOTIFICATIONS: {
    SUCCESS_DURATION: 3000,
    ERROR_DURATION: 5000,
  },
};

/**
 * Helper Functions for API calls
 */
const ApiHelper = {
  /**
   * Make authenticated API request
   */
  async request(endpoint, options = {}) {
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API Error: ${response.status}`);
    }

    return response.json();
  },

  /**
   * GET request
   */
  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  /**
   * POST request
   */
  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * PUT request
   */
  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * PATCH request
   */
  patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * DELETE request
   */
  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },
};

/**
 * Auth Helper - Handle authentication
 */
const AuthHelper = {
  /**
   * Get stored auth token
   */
  getToken() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
  },

  /**
   * Get stored user data
   */
  getUser() {
    const userData = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_DATA);
    return userData ? JSON.parse(userData) : null;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getToken();
  },

  /**
   * Check if user has specific role
   */
  hasRole(role) {
    const user = this.getUser();
    return user && user.role === role;
  },

  /**
   * Check if user is admin
   */
  isAdmin() {
    return this.hasRole('admin');
  },

  /**
   * Check if user is sales
   */
  isSales() {
    const user = this.getUser();
    return user && (user.role === 'sales' || user.role === 'admin');
  },

  /**
   * Store auth data
   */
  setAuthData(token, user) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, token);
    localStorage.setItem(CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(user));
  },

  /**
   * Clear auth data (logout)
   */
  clearAuthData() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_DATA);
  },
};

/**
 * Storage Helper - Handle localStorage
 */
const StorageHelper = {
  /**
   * Get cart from storage
   */
  getCart() {
    const cart = localStorage.getItem(CONFIG.STORAGE_KEYS.CART);
    return cart ? JSON.parse(cart) : [];
  },

  /**
   * Save cart to storage
   */
  setCart(cart) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.CART, JSON.stringify(cart));
  },

  /**
   * Clear cart
   */
  clearCart() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.CART);
  },
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, ApiHelper, AuthHelper, StorageHelper };
}

