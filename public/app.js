const productGrid = document.getElementById('productGrid');
const cartItems = document.getElementById('cartItems');
const cartCount = document.getElementById('cartCount');
const subtotalEl = document.getElementById('subtotal');
const totalEl = document.getElementById('total');
const checkoutForm = document.getElementById('checkoutForm');
const orderMessage = document.getElementById('orderMessage');
const cartToggle = document.getElementById('cartToggle');
const rentalSelect = document.getElementById('rentalOption');
const adminLink = document.getElementById('adminLink');
const salesLink = document.getElementById('salesLink');
const accountLink = document.getElementById('accountLink');
const loginLink = document.getElementById('loginLink');
const logoutLink = document.getElementById('logoutLink');

let products = [];
let cart = [];
let currentUser = null;

async function loadProducts() {
  const response = await fetch('/api/products');
  const data = await response.json();
  products = data.products;
  renderProducts();
}

async function loadUserProfile() {
  const token = localStorage.getItem('hookahToken');
  if (!token) return;

  const storedUser = localStorage.getItem('hookahUser');
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
  }

  const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  if (response.ok) {
    const data = await response.json();
    currentUser = data.user || data.profile || currentUser;
    localStorage.setItem('hookahUser', JSON.stringify(currentUser));
  }

  if (accountLink) accountLink.style.display = currentUser ? 'inline' : 'none';
  if (loginLink) loginLink.style.display = currentUser ? 'none' : 'inline';
  if (logoutLink) logoutLink.style.display = currentUser ? 'inline' : 'none';
  if (adminLink) adminLink.style.display = currentUser && currentUser.role === 'admin' ? 'inline' : 'none';
  if (salesLink) salesLink.style.display = currentUser && (currentUser.role === 'admin' || currentUser.role === 'sales') ? 'inline' : 'none';
}

function renderProducts() {
  productGrid.innerHTML = products.map((product) => `
    <article class="product-card">
      <span class="badge">${product.badge}</span>
      <img src="${product.image}" alt="${product.name}" />
      <h3>${product.name}</h3>
      <p>${product.description}</p>
      <div class="card-footer">
        <span class="price">KSh ${Number(product.price).toLocaleString()}</span>
        <button class="add-btn" data-id="${product.id}">Add</button>
      </div>
    </article>
  `).join('');
}

function updateCart() {
  cartItems.innerHTML = cart.length
    ? cart.map((item) => `
        <div class="cart-item">
          <div>
            <strong>${item.name}</strong>
            <div>${item.quantity} × KSh ${Number(item.price).toLocaleString()}</div>
          </div>
          <button class="ghost-btn" data-remove="${item.id}">Remove</button>
        </div>
      `).join('')
    : '<p>No items yet. Select your favorite flavors.</p>';

  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCount.textContent = count;

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const total = subtotal + 300;
  subtotalEl.textContent = `KSh ${subtotal.toLocaleString()}`;
  totalEl.textContent = `KSh ${total.toLocaleString()}`;
}

function addToCart(productId) {
  const product = products.find((item) => item.id === Number(productId));
  if (!product) return;

  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  updateCart();
  orderMessage.textContent = `${product.name} added to your cart.`;
}

function removeFromCart(productId) {
  cart = cart.filter((item) => item.id !== Number(productId));
  updateCart();
}

productGrid.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-id]');
  if (button) addToCart(button.dataset.id);
});

cartItems.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-remove]');
  if (button) removeFromCart(button.dataset.remove);
});

checkoutForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!cart.length) {
    orderMessage.textContent = 'Add at least one flavor before placing your order.';
    return;
  }

  const token = localStorage.getItem('hookahToken');
  if (!token) {
    window.location.href = '/account.html?next=/#checkout&message=Please login or register before checkout.';
    return;
  }

  const rentalValue = rentalSelect.value;
  const payload = {
    name: document.getElementById('name').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value,
    paymentMethod: document.querySelector('input[name="payment"]:checked').value,
    items: cart.map((item) => ({ id: item.id, name: item.name, price: item.price, quantity: item.quantity })),
    rental: {
      enabled: rentalValue !== 'none',
      nights: 1,
      amount: Number(rentalValue) || 0
    }
  };

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  const loyaltyLabel = data.pointsEarned ? ` You earned ${data.pointsEarned} loyalty points.` : '';
  orderMessage.textContent = `${data.message || 'Order placed.'}${loyaltyLabel}`;
  if (data.success) {
    cart = [];
    updateCart();
    checkoutForm.reset();
    if (data.user) {
      localStorage.setItem('hookahUser', JSON.stringify(data.user));
      currentUser = data.user;
    }
  }
});

cartToggle.addEventListener('click', () => {
  document.getElementById('checkout').scrollIntoView({ behavior: 'smooth' });
});

if (logoutLink) {
  logoutLink.addEventListener('click', (event) => {
    event.preventDefault();
    localStorage.removeItem('hookahToken');
    localStorage.removeItem('hookahUser');
    window.location.href = '/';
  });
}

loadProducts();
loadUserProfile();
updateCart();
