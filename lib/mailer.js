const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

function isSafeBaseUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    return !hostname.includes('ngrok');
  } catch (error) {
    return false;
  }
}

function getMailConfig() {
  const host = process.env.SMTP_HOST || process.env.MAIL_HOST;
  if (!host) {
    return null;
  }

  return {
    host,
    port: Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 587),
    secure: String(process.env.SMTP_SECURE || process.env.MAIL_SECURE || 'false').toLowerCase() === 'true',
    auth: process.env.SMTP_USER || process.env.MAIL_USER
      ? {
          user: process.env.SMTP_USER || process.env.MAIL_USER,
          pass: process.env.SMTP_PASS || process.env.MAIL_PASS,
        }
      : undefined,
  };
}

function getBaseUrl() {
  dotenv.config({ override: true });
  const configured = process.env.APP_URL || process.env.BASE_URL;
  if (isSafeBaseUrl(configured)) {
    return configured;
  }
  return `http://localhost:${process.env.PORT || 3001}`;
}

function createMailer({ transporter } = {}) {
  const transport = transporter || (getMailConfig() ? nodemailer.createTransport(getMailConfig()) : null);
  const fromAddress = process.env.MAIL_FROM || process.env.SMTP_FROM || 'no-reply@hookah.store';
  const siteName = process.env.APP_NAME || 'Hookah Store';

  return {
    transport,
    sendMail: async (options) => {
      if (!transport) {
        console.warn('SMTP is not configured. Skipping email delivery.');
        return { skipped: true, reason: 'SMTP not configured' };
      }

      return transport.sendMail({
        from: options.from || fromAddress,
        ...options,
      });
    },
    async sendVerificationEmail({ to, name, verificationUrl }) {
      const baseUrl = getBaseUrl();
      return this.sendMail({
        to,
        subject: `${siteName} - Verify your email`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Welcome to ${siteName}</h2>
            <p>Hi ${name || 'there'},</p>
            <p>Thank you for creating an account. Please verify your email address by clicking the link below.</p>
            <p><a href="${verificationUrl || `${baseUrl}/account.html`}" style="display:inline-block;padding:10px 16px;background:#a67c52;color:white;text-decoration:none;border-radius:6px;">Verify email</a></p>
            <p>If the button does not work, copy and paste this link into your browser:</p>
            <p>${verificationUrl || `${baseUrl}/account.html`}</p>
          </div>
        `,
      });
    },
    async sendPasswordResetEmail({ to, name, resetUrl }) {
      const baseUrl = getBaseUrl();
      return this.sendMail({
        to,
        subject: `${siteName} - Reset your password`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Reset your password</h2>
            <p>Hi ${name || 'there'},</p>
            <p>We received a request to reset your password. Click the button below to choose a new password.</p>
            <p><a href="${resetUrl || `${baseUrl}/account.html`}" style="display:inline-block;padding:10px 16px;background:#a67c52;color:white;text-decoration:none;border-radius:6px;">Create a new password</a></p>
            <p>If the button does not work, copy and paste this link into your browser:</p>
            <p>${resetUrl || `${baseUrl}/account.html`}</p>
          </div>
        `,
      });
    },
    async sendOrderConfirmationEmail({ to, name, order }) {
      const rows = (order.items || []).map((item) => `
          <tr style="border-bottom:1px solid #e2e2e2;">
            <td style="padding:8px 0;">${item.name || item.product || 'Item'}</td>
            <td style="padding:8px 0;text-align:center;">${item.quantity || 1}</td>
            <td style="padding:8px 0;text-align:right;">${Number(item.price || 0).toFixed(2)}</td>
          </tr>
        `).join('');
      return this.sendMail({
        to,
        subject: `${siteName} - Order Confirmation ${order.orderNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Thank you for your order, ${name || 'Customer'}!</h2>
            <p>Your order <strong>#${order.orderNumber}</strong> has been received and is being processed.</p>
            <h3>Order details</h3>
            <p><strong>Name:</strong> ${order.customerName}</p>
            <p><strong>Email:</strong> ${to}</p>
            <p><strong>Phone:</strong> ${order.phone}</p>
            <p><strong>Address:</strong> ${order.address}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
            <table style="width:100%;border-collapse:collapse;margin-top:16px;">
              <thead>
                <tr>
                  <th style="text-align:left;padding:8px 0;">Item</th>
                  <th style="text-align:center;padding:8px 0;">Qty</th>
                  <th style="text-align:right;padding:8px 0;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
            <p style="text-align:right;margin-top:16px;"><strong>Subtotal:</strong> ${Number(order.subtotal).toFixed(2)}</p>
            <p style="text-align:right;margin-top:4px;"><strong>Delivery Fee:</strong> ${Number(order.deliveryFee).toFixed(2)}</p>
            <p style="text-align:right;margin-top:4px;"><strong>Rental Fee:</strong> ${Number(order.rentalFee).toFixed(2)}</strong></p>
            <p style="text-align:right;margin-top:4px;"><strong>Total:</strong> ${Number(order.total).toFixed(2)}</p>
            <p style="margin-top:24px;">If you have any questions, reply to this email and we’ll be happy to help.</p>
          </div>
        `,
      });
    },
    async sendOrderNotificationEmail({ to, order, customerEmail, customerName }) {
      const rows = (order.items || []).map((item) => `
          <tr style="border-bottom:1px solid #e2e2e2;">
            <td style="padding:8px 0;">${item.name || item.product || 'Item'}</td>
            <td style="padding:8px 0;text-align:center;">${item.quantity || 1}</td>
            <td style="padding:8px 0;text-align:right;">${Number(item.price || 0).toFixed(2)}</td>
          </tr>
        `).join('');
      return this.sendMail({
        to,
        subject: `${siteName} - New Order Received ${order.orderNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>New order received</h2>
            <p>A new order has been placed by ${customerName || order.customerName}.</p>
            <p><strong>Order:</strong> #${order.orderNumber}</p>
            <p><strong>Customer:</strong> ${customerName || order.customerName}</p>
            <p><strong>Email:</strong> ${customerEmail || ''}</p>
            <p><strong>Phone:</strong> ${order.phone}</p>
            <p><strong>Address:</strong> ${order.address}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
            <table style="width:100%;border-collapse:collapse;margin-top:16px;">
              <thead>
                <tr>
                  <th style="text-align:left;padding:8px 0;">Item</th>
                  <th style="text-align:center;padding:8px 0;">Qty</th>
                  <th style="text-align:right;padding:8px 0;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
            <p style="text-align:right;margin-top:16px;"><strong>Subtotal:</strong> ${Number(order.subtotal).toFixed(2)}</p>
            <p style="text-align:right;margin-top:4px;"><strong>Delivery Fee:</strong> ${Number(order.deliveryFee).toFixed(2)}</p>
            <p style="text-align:right;margin-top:4px;"><strong>Rental Fee:</strong> ${Number(order.rentalFee).toFixed(2)}</p>
            <p style="text-align:right;margin-top:4px;"><strong>Total:</strong> ${Number(order.total).toFixed(2)}</p>
          </div>
        `,
      });
    },
    async sendSiteReportEmail({ to, subject, summary }) {
      const lines = Object.entries(summary || {}).map(([key, value]) => `<li><strong>${key}</strong>: ${value}</li>`).join('');
      return this.sendMail({
        to,
        subject: subject || `${siteName} activity report`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>${siteName} activity report</h2>
            <p>Here is a quick summary of the latest activity.</p>
            <ul>${lines}</ul>
          </div>
        `,
      });
    },
  };
}

module.exports = {
  createMailer,
  getMailConfig,
};
