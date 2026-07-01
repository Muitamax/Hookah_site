const modeButtons = document.querySelectorAll('.switcher button');
const panels = {
  login: document.getElementById('loginPanel'),
  register: document.getElementById('registerPanel')
};
const notice = document.getElementById('authNotice');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const forgotPasswordPanel = document.getElementById('forgotPasswordPanel');
const resetPasswordPanel = document.getElementById('resetPasswordPanel');
const resetEmail = document.getElementById('forgotEmail');
const resetToken = document.getElementById('resetToken');
const newPasswordInput = document.getElementById('newPassword');
const params = new URLSearchParams(window.location.search);

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    modeButtons.forEach((btn) => btn.classList.remove('active'));
    button.classList.add('active');
    const mode = button.dataset.mode;
    Object.entries(panels).forEach(([key, panel]) => panel.classList.toggle('active', key === mode));
  });
});

if (params.get('message')) {
  notice.textContent = params.get('message');
}

if (params.get('token') && params.get('email')) {
  resetEmail.value = params.get('email');
  resetToken.value = params.get('token');
  forgotPasswordPanel.style.display = 'grid';
  resetPasswordPanel.style.display = 'grid';
  notice.textContent = notice.textContent || 'Choose a new password for your account.';
}

if (localStorage.getItem('hookahToken')) {
  window.location.href = '/my-account.html';
}

forgotPasswordLink.addEventListener('click', () => {
  forgotPasswordPanel.style.display = forgotPasswordPanel.style.display === 'none' ? 'grid' : 'none';
  resetPasswordPanel.style.display = 'none';
});

document.getElementById('requestResetBtn').addEventListener('click', async () => {
  const email = document.getElementById('forgotEmail').value;
  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await response.json();
  notice.textContent = data.message || 'Request received.';
  if (data.resetToken) {
    document.getElementById('resetToken').value = data.resetToken;
    resetPasswordPanel.style.display = 'grid';
  }
});

document.getElementById('confirmResetBtn').addEventListener('click', async () => {
  const email = document.getElementById('forgotEmail').value;
  const token = document.getElementById('resetToken').value;
  const password = document.getElementById('newPassword').value;
  const response = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token, password })
  });
  const data = await response.json();
  notice.textContent = data.message || 'Password reset failed.';
  if (data.token) {
    localStorage.setItem('hookahToken', data.token);
    localStorage.setItem('hookahUser', JSON.stringify(data.user || {}));
    window.location.href = params.get('next') || '/';
  }
});

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    email: document.getElementById('loginEmail').value,
    password: document.getElementById('loginPassword').value
  };

  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  notice.textContent = data.message || (data.user ? 'Signed in successfully.' : 'Unable to sign in.');
  if (data.token) {
    localStorage.setItem('hookahToken', data.token);
    localStorage.setItem('hookahUser', JSON.stringify(data.user || data.profile || {}));
    window.location.href = params.get('next') || '/';
  }
});

document.getElementById('registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    name: document.getElementById('registerName').value,
    email: document.getElementById('registerEmail').value,
    password: document.getElementById('registerPassword').value
  };

  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  notice.textContent = data.message || 'Unable to create account.';
  if (data.user && data.token) {
    localStorage.setItem('hookahToken', data.token);
    localStorage.setItem('hookahUser', JSON.stringify(data.user || data.profile || {}));
    window.location.href = params.get('next') || '/';
  }
});
