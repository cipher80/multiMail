require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const http = require('http');
const nodemailer = require('nodemailer');
const multer = require('multer');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { DEFAULT_TEMPLATES, BUILT_IN_IDS } = require('./defaultTemplates');

// ─── Gmail SMTP Config ────────────────────────────────────────────────────────
const SMTP_USER = 'uttamg61001@gmail.com';
const SMTP_PASS = 'ojao pubs sgso cvxz';
const SENDER_NAME = process.env.SENDER_NAME || SMTP_USER.split('@')[0];
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

// ─── Templates JSON store ─────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const TEMPLATES_TMP = TEMPLATES_FILE + '.tmp';

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readCustomTemplates() {
  ensureDataDir();
  if (!fs.existsSync(TEMPLATES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(TEMPLATES_FILE, 'utf8'));
  } catch {
    return [];
  }
}

/** Atomic write: write temp then rename so a crash never leaves a broken file. */
function writeCustomTemplates(templates) {
  ensureDataDir();
  fs.writeFileSync(TEMPLATES_TMP, JSON.stringify(templates, null, 2), 'utf8');
  fs.renameSync(TEMPLATES_TMP, TEMPLATES_FILE);
}

function getAllTemplates() {
  const custom = readCustomTemplates();
  return [...DEFAULT_TEMPLATES, ...custom];
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
function setCORSHeaders(res, methods = 'GET, POST, PUT, DELETE, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── Body parser for JSON requests ───────────────────────────────────────────
function readJSON(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ─── Multipart parser ────────────────────────────────────────────────────────
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const uploadAny = upload.array('attachments', 10);
    uploadAny(req, {}, (err) => {
      if (err) return reject(err);
      resolve({ fields: req.body, files: req.files || [] });
    });
  });
}

// ─── Validation helpers ───────────────────────────────────────────────────────
function validateTemplate({ name, subject, body }) {
  if (!name || typeof name !== 'string' || !name.trim())
    return 'Name is required.';
  if (name.trim().length > 50)
    return 'Name must be 50 characters or fewer.';
  if (!subject || typeof subject !== 'string' || !subject.trim())
    return 'Subject is required.';
  if (!body || typeof body !== 'string' || !body.trim())
    return 'Body is required.';
  if (body.length > 5000)
    return 'Body must be 5000 characters or fewer.';
  return null;
}

// ─── Email helpers ────────────────────────────────────────────────────────────
/** Escape HTML special chars in user-supplied plain text. */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert escaped plain text with newlines into an HTML body.
 *  Also makes https?:// URLs clickable. */
function textToHtml(plain) {
  const escaped = escapeHtml(plain);
  // Make URLs clickable
  const linked = escaped.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" style="color:#a89fff;">$1</a>',
  );
  return linked.replace(/\n/g, '<br>');
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

async function sendToRecipient(recipient, subject, plainBody, attachments) {
  const html = textToHtml(plainBody);
  const text = plainBody;

  const mailOptions = {
    from: { name: SENDER_NAME, address: SMTP_USER },
    replyTo: SMTP_USER,
    to: recipient,
    subject,
    text: text || subject,
    html: html || `<p>${escapeHtml(subject)}</p>`,
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

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);
  const { pathname } = parsedUrl;

  if (req.method === 'OPTIONS') {
    setCORSHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  setCORSHeaders(res);

  // ── Health ────────────────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', sender: SMTP_USER }));
    return;
  }

  // ── GET /api/templates ────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/templates') {
    try {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getAllTemplates()));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── POST /api/templates ───────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/templates') {
    try {
      const body = await readJSON(req);
      const err = validateTemplate(body);
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err }));
        return;
      }

      const custom = readCustomTemplates();
      const nameLower = body.name.trim().toLowerCase();

      // Check uniqueness across built-ins + custom
      const allNames = [
        ...DEFAULT_TEMPLATES.map((t) => t.name.toLowerCase()),
        ...custom.map((t) => t.name.toLowerCase()),
      ];
      if (allNames.includes(nameLower)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'A template with that name already exists.' }));
        return;
      }

      const newTemplate = {
        id: crypto.randomUUID(),
        name: body.name.trim(),
        subject: body.subject.trim(),
        body: body.body,
        isBuiltIn: false,
        updatedAt: new Date().toISOString(),
      };
      custom.push(newTemplate);
      writeCustomTemplates(custom);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(newTemplate));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── PUT /api/templates/:id ────────────────────────────────────────────────
  const putMatch = pathname.match(/^\/api\/templates\/([^/]+)$/);
  if (req.method === 'PUT' && putMatch) {
    const id = decodeURIComponent(putMatch[1]);
    try {
      if (BUILT_IN_IDS.has(id)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Built-in templates cannot be modified.' }));
        return;
      }

      const body = await readJSON(req);
      const err = validateTemplate(body);
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err }));
        return;
      }

      const custom = readCustomTemplates();
      const idx = custom.findIndex((t) => t.id === id);
      if (idx === -1) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Template not found.' }));
        return;
      }

      // Check name uniqueness (excluding self)
      const nameLower = body.name.trim().toLowerCase();
      const duplicate = [
        ...DEFAULT_TEMPLATES.map((t) => t.name.toLowerCase()),
        ...custom.filter((t) => t.id !== id).map((t) => t.name.toLowerCase()),
      ].includes(nameLower);
      if (duplicate) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'A template with that name already exists.' }));
        return;
      }

      custom[idx] = {
        ...custom[idx],
        name: body.name.trim(),
        subject: body.subject.trim(),
        body: body.body,
        updatedAt: new Date().toISOString(),
      };
      writeCustomTemplates(custom);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(custom[idx]));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── DELETE /api/templates/:id ─────────────────────────────────────────────
  const delMatch = pathname.match(/^\/api\/templates\/([^/]+)$/);
  if (req.method === 'DELETE' && delMatch) {
    const id = decodeURIComponent(delMatch[1]);
    try {
      if (BUILT_IN_IDS.has(id)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Built-in templates cannot be deleted.' }));
        return;
      }

      const custom = readCustomTemplates();
      const idx = custom.findIndex((t) => t.id === id);
      if (idx === -1) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Template not found.' }));
        return;
      }

      custom.splice(idx, 1);
      writeCustomTemplates(custom);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── POST /api/send ────────────────────────────────────────────────────────
  const isSendRoute =
    req.method === 'POST' &&
    (pathname === '/send' || pathname === '/api/send');

  if (isSendRoute) {
    try {
      const { fields, files } = await parseMultipart(req);

      const subject = fields.subject || '(No Subject)';
      // body arrives as plain text from the client (no pre-escaping needed here)
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
