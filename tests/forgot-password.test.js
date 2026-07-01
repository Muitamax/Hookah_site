const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { once } = require('events');
const app = require('../server');

function request(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: server.address().port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: responseBody }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

test('password reset flow works for a registered user', async () => {
  const server = app.listen(0);
  await once(server, 'listening');

  try {
    const uniqueSuffix = Date.now();
    const email = `forgot-${uniqueSuffix}@example.com`;

    const registerRes = await request(server, 'POST', '/api/auth/register', {
      name: 'Reset Tester',
      email,
      password: 'StrongPass123!',
    });
    assert.equal(registerRes.statusCode, 201);

    const forgotRes = await request(server, 'POST', '/api/auth/forgot-password', { email });
    assert.equal(forgotRes.statusCode, 200);
    const forgotData = JSON.parse(forgotRes.body);
    assert.ok(forgotData.resetToken, 'expected a reset token to be returned');

    const resetRes = await request(server, 'POST', '/api/auth/reset-password', {
      email,
      token: forgotData.resetToken,
      password: 'NewStrongPass123!',
    });
    assert.equal(resetRes.statusCode, 200);

    const resetData = JSON.parse(resetRes.body);
    assert.ok(resetData.token, 'expected an auth token after reset');

    const loginRes = await request(server, 'POST', '/api/auth/login', {
      email,
      password: 'NewStrongPass123!',
    });
    assert.equal(loginRes.statusCode, 200);
  } finally {
    server.close();
  }
});
