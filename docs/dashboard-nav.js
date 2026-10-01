document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.dashboard-sidebar');
  const toggle = document.getElementById('dashboardToggle');
  const adminNavLink = document.getElementById('adminNavLink');
  const salesNavLink = document.getElementById('salesNavLink');
  const logoutNavLink = document.getElementById('logoutNavLink');
  const profileBadge = document.getElementById('profileBadge');

  if (!sidebar) return;

  const syncNav = () => {
    const token = localStorage.getItem('hookahToken');
    const storedUser = localStorage.getItem('hookahUser');
    const user = storedUser ? JSON.parse(storedUser) : null;

    if (adminNavLink) {
      adminNavLink.style.display = token && user && user.role === 'admin' ? 'inline-flex' : 'none';
    }

    if (salesNavLink) {
      salesNavLink.style.display = token && user && (user.role === 'admin' || user.role === 'sales') ? 'inline-flex' : 'none';
    }

    if (logoutNavLink) {
      logoutNavLink.style.display = token ? 'inline-flex' : 'none';
    }

    if (profileBadge) {
      profileBadge.textContent = user ? `Hi, ${user.name || 'there'}` : 'Guest';
    }
  };

  const updateCollapsedState = () => {
    sidebar.classList.toggle('collapsed', window.scrollY > 80);
  };

  if (toggle) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  window.addEventListener('scroll', updateCollapsedState, { passive: true });
  window.addEventListener('storage', syncNav);
  syncNav();
  updateCollapsedState();

  if (logoutNavLink) {
    logoutNavLink.addEventListener('click', (event) => {
      event.preventDefault();
      localStorage.removeItem('hookahToken');
      localStorage.removeItem('hookahUser');
      window.location.href = '/';
    });
  }
});
