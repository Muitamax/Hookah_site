const token = localStorage.getItem('hookahToken');
const ordersList = document.getElementById('ordersList');

async function loadSalesData() {
  if (!token) {
    ordersList.innerHTML = '<div class="row">Please sign in as the sales account to manage orders.</div>';
    return;
  }

  const authResponse = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  if (!authResponse.ok) {
    ordersList.innerHTML = '<div class="row">Please sign in again to continue.</div>';
    return;
  }

  const response = await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  ordersList.innerHTML = (data.orders || []).map((order) => `
    <div class="panel" style="padding: 12px; margin-bottom: 10px;">
      <div class="row"><strong>${order.order_number}</strong><span>${order.status}</span></div>
      <div class="row"><span>${order.customer_name}</span><span>${order.phone}</span></div>
      <div class="row"><span>${order.address}</span><span>KSh ${Number(order.total).toLocaleString()}</span></div>
      <div class="row"><span>${order.rental && order.rental.enabled ? 'Pot rental enabled' : 'No rental'}</span><span>${order.payment_method}</span></div>
      <div class="row">
        <select data-order-id="${order.id}">
          <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
          <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
          <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
        <button class="primary-btn" data-action="status" data-order-id="${order.id}">Update</button>
      </div>
    </div>
  `).join('');
}

ordersList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="status"]');
  if (!button) return;
  const orderId = button.dataset.orderId;
  const select = document.querySelector(`select[data-order-id="${orderId}"]`);
  const response = await fetch(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status: select.value })
  });
  if (response.ok) {
    loadSalesData();
  }
});

loadSalesData();
