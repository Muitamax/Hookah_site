const test = require('node:test');
const assert = require('node:assert/strict');
const { getPostAuthRedirect } = require('../public/auth-redirect');

test('uses the next parameter when one is provided', () => {
  const params = new URLSearchParams('next=/my-account.html');
  assert.equal(getPostAuthRedirect(params), '/my-account.html');
});

test('falls back to the account dashboard when no next parameter exists', () => {
  const params = new URLSearchParams('token=abc&email=test@example.com');
  assert.equal(getPostAuthRedirect(params), '/my-account.html');
});
