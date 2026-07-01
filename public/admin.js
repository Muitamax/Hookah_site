const token = localStorage.getItem('hookahToken');
const ordersList = document.getElementById('ordersList');
const logsList = document.getElementById('logsList');
const usersList = document.getElementById('usersList');

async function loadAdminData() {
  if (!token) {
    ordersList.innerHTML = '<div class="card">Please sign in as the admin account to manage the store.</div>';
    return;
  }

  const [authResponse, ordersResponse, usersResponse, logsResponse] = await Promise.all([
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } }),
    fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } }),
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
    fetch('/api/logs', { headers: { Authorization: `Bearer ${token}` } })
  ]);

  if (!authResponse.ok) {
    ordersList.innerHTML = '<div class="card">You need admin access to use this dashboard.</div>';
    return;
  }

  const ordersData = await ordersResponse.json();
  const usersData = await usersResponse.json();
  const logsData = await logsResponse.json();

  usersList.innerHTML = (usersData.users || []).map((user) => `
    <div class="row"><span>${user.name}</span><span class="muted">${user.email} • ${user.role}</span></div>
  `).join('');

  ordersList.innerHTML = (ordersData.orders || []).map((order) => `
    <div class="card">
      <div class="row"><strong>${order.order_number}</strong><span>${order.status}</span></div>
      <div class="row"><span>${order.customer_name}</span><span>${order.phone}</span></div>
      <div class="row"><span>${order.address}</span><span>KSh ${Number(order.total).toLocaleString()}</span></div>
      <div class="row"><span>${order.rental && order.rental.enabled ? 'Pot rental enabled' : 'No rental'}</span><span>${order.payment_method}</span></div>
    </div>
  `).join('');

  logsList.innerHTML = (logsData.logs || []).map((log) => `
    <div class="row"><span>${log.path} • ${log.method}</span><span class="muted">${new Date(log.created_at).toLocaleString()}</span></div>
  `).join('');
}

document.getElementById('productForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    name: document.getElementById('productName').value,
    price: document.getElementById('productPrice').value,
    description: document.getElementById('productDescription').value,
    image: document.getElementById('productImage').value,
    category: document.getElementById('productCategory').value
  };

  const response = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (data.product) {
    document.getElementById('productForm').reset();
    loadAdminData();
  }
});

loadAdminData();
