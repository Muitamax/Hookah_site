const test = require('node:test');
const assert = require('node:assert/strict');
const { createMailer } = require('../lib/mailer');

test('sendVerificationEmail builds a verification message with a link', async () => {
  const sent = [];
  const mailer = createMailer({
    transporter: {
      sendMail: async (options) => {
        sent.push(options);
        return { messageId: 'test-verify' };
      },
    },
  });

  await mailer.sendVerificationEmail({
    to: 'customer@example.com',
    name: 'Ada',
    verificationUrl: 'http://localhost:3001/api/auth/verify-email?token=abc123&email=customer@example.com',
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'customer@example.com');
  assert.match(sent[0].subject, /verify/i);
  assert.match(sent[0].html, /verify-email/i);
});

test('sendPasswordResetEmail builds a password reset message with a link', async () => {
  const sent = [];
  const mailer = createMailer({
    transporter: {
      sendMail: async (options) => {
        sent.push(options);
        return { messageId: 'test-reset' };
      },
    },
  });

  await mailer.sendPasswordResetEmail({
    to: 'customer@example.com',
    name: 'Ada',
    resetUrl: 'http://localhost:3001/account.html?token=abc123&email=customer@example.com',
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'customer@example.com');
  assert.match(sent[0].subject, /password/i);
  assert.match(sent[0].html, /reset/i);
});
