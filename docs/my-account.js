const profileGrid = document.getElementById('profileGrid');
const ordersList = document.getElementById('ordersList');
let profileFormBound = false;
let cachedOrders = [];
let currentUser = null;

function renderOrders() {
  ordersList.innerHTML = cachedOrders.length
    ? cachedOrders.map((order) => `
      <div class="row">
        <div>
          <strong>${order.order_number || order.orderNumber}</strong>
          <div class="muted">${order.status || 'pending'}</div>
        </div>
        <div class="muted">KSh ${Number(order.total || 0).toLocaleString()}</div>
      </div>
    `).join('')
    : '<div class="row"><span>No orders yet.</span></div>';
}

function renderProfile(user) {
  currentUser = user;
  profileGrid.innerHTML = `
    <div class="profile-stat">
      <div class="muted">Name</div>
      <strong>${user.name || 'Guest'}</strong>
    </div>
    <div class="profile-stat">
      <div class="muted">Email</div>
      <strong>${user.email || '—'}</strong>
    </div>
    <div class="profile-stat">
      <div class="muted">Role</div>
      <strong>${user.role || 'customer'}</strong>
    </div>
    <div class="profile-stat">
      <div class="muted">Loyalty points</div>
      <strong>${Number(user.loyaltyPoints || user.loyalty_points || 0)}</strong>
    </div>
  `;
}

async function loadMyAccount() {
  const token = localStorage.getItem('hookahToken');
  if (!token) {
    window.location.href = '/account.html?next=/my-account.html';
    return;
  }

  const [profileResponse, ordersResponse] = await Promise.all([
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
    fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } }),
  ]);

  if (!profileResponse.ok) {
    localStorage.removeItem('hookahToken');
    localStorage.removeItem('hookahUser');
    window.location.href = '/account.html?next=/my-account.html';
    return;
  }

  const profileData = await profileResponse.json();
  const ordersData = await ordersResponse.json();
  const user = profileData.user || profileData.profile || {};
  localStorage.setItem('hookahUser', JSON.stringify(user));

  renderProfile(user);
  cachedOrders = ordersData.orders || [];
  renderOrders();

  const profileForm = document.getElementById('profileForm');
  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');
  const profileMessage = document.getElementById('profileMessage');

  if (profileName && profileEmail) {
    profileName.value = user.name || '';
    profileEmail.value = user.email || '';
  }

  if (profileForm && !profileFormBound) {
    profileFormBound = true;
    profileForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!profileName.value || !profileEmail.value) {
        if (profileMessage) {
          profileMessage.className = 'profile-message error';
          profileMessage.textContent = 'Name and email are required.';
        }
        return;
      }

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: profileName.value, email: profileEmail.value })
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('hookahToken', data.token);
        localStorage.setItem('hookahUser', JSON.stringify(data.user));
        renderProfile(data.user);
        if (profileMessage) {
          profileMessage.className = 'profile-message success';
          profileMessage.textContent = data.message;
        }
      } else {
        if (profileMessage) {
          profileMessage.className = 'profile-message error';
          profileMessage.textContent = data.message || 'Unable to update profile.';
        }
      }
    });
  }

}

loadMyAccount();
