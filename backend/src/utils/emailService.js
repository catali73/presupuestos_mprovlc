const nodemailer = require('nodemailer');

// Microsoft 365 / Exchange Online requiere STARTTLS en puerto 587
// tls.ciphers evita errores de handshake con servidores Exchange estrictos
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // STARTTLS (no SSL directo)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false,
  },
});

async function send({ to, cc, subject, text, html, attachments = [] }) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    cc: cc || undefined,
    subject,
    text,
    html,
    attachments,
  });
}

module.exports = { send };
