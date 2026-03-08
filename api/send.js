const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));

// ─── Gmail SMTP — credentials hardcoded (no .env) ────────────────────────────
const SMTP_USER = 'uttamg61001@gmail.com';
const SMTP_PASS = 'ojao pubs sgso cvxz';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// ─── Multer: in-memory, no files written to disk ─────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB — Vercel serverless body limit is 4.5 MB
});

// ─── POST /api/send ───────────────────────────────────────────────────────────
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

    // Send one individual email per recipient — no CC, no BCC
    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        transporter.sendMail({
          from: SMTP_USER,
          to: recipient.trim(),
          subject: subject || '(No Subject)',
          html: body || '',
          attachments: files.map((f) => ({
            filename: f.originalname,
            content: f.buffer,
            contentType: f.mimetype,
          })),
        })
      )
    );

    const summary = results.map((result, idx) => ({
      recipient: recipients[idx],
      status: result.status === 'fulfilled' ? 'sent' : 'failed',
      error: result.status === 'rejected' ? result.reason?.message : null,
    }));

    res.json({ results: summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', sender: SMTP_USER });
});

module.exports = app;
