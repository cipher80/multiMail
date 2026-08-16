const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));

const SMTP_USER = 'uttamg61001@gmail.com';
const SMTP_PASS = 'ojao pubs sgso cvxz';
const SENDER_NAME = 'MultiMail';
const SEND_GAP_MS = 400;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

function htmlToText(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendToRecipient(recipient, subject, body, files) {
  const html = body || '';
  const text = htmlToText(html);

  return transporter.sendMail({
    from: `"${SENDER_NAME}" <${SMTP_USER}>`,
    replyTo: SMTP_USER,
    to: recipient.trim(),
    subject: subject || '(No Subject)',
    text: text || subject || '(No Subject)',
    html: html || `<p>${subject || ''}</p>`,
    attachments: files.map((f) => ({
      filename: f.originalname,
      content: f.buffer,
      contentType: f.mimetype,
    })),
    headers: {
      'X-Mailer': 'MultiMail',
      'List-Unsubscribe': `<mailto:${SMTP_USER}?subject=unsubscribe>`,
    },
  });
}

app.post('/api/send', upload.array('attachments', 10), async (req, res) => {
  try {
    const { subject, body, recipients: recipientsRaw } = req.body;
    const files = req.files || [];

    let recipients = [];
    try {
      recipients = JSON.parse(recipientsRaw);
    } catch {
      recipients = recipientsRaw
        ? recipientsRaw.split(',').map((r) => r.trim()).filter(Boolean)
        : [];
    }

    if (!recipients.length) {
      return res.status(400).json({ error: 'No recipients provided.' });
    }

    const summary = [];
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      try {
        await sendToRecipient(recipient, subject, body, files);
        summary.push({ recipient, status: 'sent', error: null });
      } catch (err) {
        summary.push({
          recipient,
          status: 'failed',
          error: err?.message || String(err),
        });
      }
      if (i < recipients.length - 1) {
        await sleep(SEND_GAP_MS);
      }
    }

    res.json({ results: summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', sender: SMTP_USER });
});

module.exports = app;
