const http = require('http');
const nodemailer = require('nodemailer');
const multer = require('multer');
const url = require('url');

// ─── Gmail SMTP Config ────────────────────────────────────────────────────────
const SMTP_USER = 'uttamg61001@gmail.com';
const SMTP_PASS = 'ojao pubs sgso cvxz';
const SENDER_NAME = 'MultiMail';
/** Small gap between messages reduces bulk-blast signals (ms). */
const SEND_GAP_MS = 400;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

// ─── Multer: in-memory storage (no files written to disk) ────────────────────
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max (Gmail SMTP limit)
});

function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const uploadAny = upload.array('attachments', 10);
    uploadAny(req, {}, (err) => {
      if (err) return reject(err);
      resolve({ fields: req.body, files: req.files || [] });
    });
  });
}

/** Strip HTML for multipart/alternative text part (helps inbox placement). */
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

async function sendToRecipient(recipient, subject, body, attachments) {
  const html = body || '';
  const text = htmlToText(html);

  const mailOptions = {
    from: `"${SENDER_NAME}" <${SMTP_USER}>`,
    replyTo: SMTP_USER,
    to: recipient,
    subject,
    text: text || subject,
    html: html || `<p>${subject}</p>`,
    attachments: attachments.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype,
    })),
    headers: {
      'X-Mailer': 'MultiMail',
      'List-Unsubscribe': `<mailto:${SMTP_USER}?subject=unsubscribe>`,
    },
  };
  return transporter.sendMail(mailOptions);
}

/** Send one-by-one with a short gap (better than parallel blast for filters). */
async function sendAll(recipients, subject, body, files) {
  const summary = [];
  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i].trim();
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
  return summary;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);

  if (req.method === 'OPTIONS') {
    setCORSHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  setCORSHeaders(res);

  if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', sender: SMTP_USER }));
    return;
  }

  const isSendRoute =
    req.method === 'POST' &&
    (parsedUrl.pathname === '/send' || parsedUrl.pathname === '/api/send');

  if (isSendRoute) {
    try {
      const { fields, files } = await parseMultipart(req);

      const subject = fields.subject || '(No Subject)';
      const body = fields.body || '';
      const recipientsRaw = fields.recipients;

      let recipients = [];
      try {
        recipients = JSON.parse(recipientsRaw);
      } catch {
        recipients = recipientsRaw
          ? recipientsRaw.split(',').map((r) => r.trim()).filter(Boolean)
          : [];
      }

      if (!recipients || recipients.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No recipients provided.' }));
        return;
      }

      const summary = await sendAll(recipients, subject, body, files);

      const allFailed = summary.every((r) => r.status === 'failed');
      res.writeHead(allFailed ? 500 : 200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ results: summary }));
    } catch (err) {
      console.error('Send error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = 3004;
server.listen(PORT, () => {
  console.log(`✅ MultiMail server running on http://localhost:${PORT}`);
  console.log(`📧 Sending as: ${SMTP_USER}`);
});
