const http = require('http');
const nodemailer = require('nodemailer');
const multer = require('multer');
const url = require('url');
const pdf = require('pdf-parse');

// ─── Gmail SMTP Config ────────────────────────────────────────────────────────
const SMTP_USER = 'uttamg61001@gmail.com';
const SMTP_PASS = 'ojao pubs sgso cvxz';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true,           // Reuses connection so we don't login 24 times
  maxConnections: 3,    // Safe number of concurrent socket connections
  maxMessages: 100,
  socketTimeout: 10000, // 10 seconds timeout so it never hangs infinitely
  connectionTimeout: 10000,
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

// ─── CORS Headers ─────────────────────────────────────────────────────────────
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── Parse multipart form using multer ───────────────────────────────────────
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const uploadAny = upload.array('attachments', 10);
    uploadAny(req, {}, (err) => {
      if (err) return reject(err);
      resolve({ fields: req.body, files: req.files || [] });
    });
  });
}

// ─── Send one email to one recipient ─────────────────────────────────────────
async function sendToRecipient(recipient, subject, body, attachments) {
  const mailOptions = {
    from: SMTP_USER,
    to: recipient,
    subject: subject,
    html: body,
    attachments: attachments.map((file) => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype,
    })),
  };
  return transporter.sendMail(mailOptions);
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setCORSHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  setCORSHeaders(res);

  // Health check
  if (req.method === 'GET' && parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', sender: SMTP_USER }));
    return;
  }

  // Extract emails from PDF endpoint
  if (req.method === 'POST' && parsedUrl.pathname === '/api/extract-emails') {
    try {
      const uploadSingle = upload.single('pdf');
      
      await new Promise((resolve, reject) => {
        uploadSingle(req, {}, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });

      if (!req.file) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No PDF file uploaded.' }));
        return;
      }

      const data = await pdf(req.file.buffer);
      // Regex to find all valid email addresses
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
      const foundEmails = data.text.match(emailRegex) || [];
      // Remove duplicates and trim
      const uniqueEmails = Array.from(new Set(foundEmails.map(e => e.trim().toLowerCase())));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ emails: uniqueEmails }));
    } catch (err) {
      console.error('PDF Extraction error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Main send endpoint — handles both /send (legacy) and /api/send (Vercel-compatible)
  const isSendRoute =
    req.method === 'POST' &&
    (parsedUrl.pathname === '/send' || parsedUrl.pathname === '/api/send');

  if (isSendRoute) {
    try {
      const { fields, files } = await parseMultipart(req);

      const subject = fields.subject || '(No Subject)';
      const body = fields.body || '';
      const recipientsRaw = fields.recipients;

      // recipients can be a JSON string array or a plain string
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

      // Send emails in small chunks (batches of 3) with a short delay in between
      // This solves both "infinite loading hang" and Gmail's anti-spam blocks
      const results = [];
      const chunkSize = 3;
      for (let i = 0; i < recipients.length; i += chunkSize) {
        const chunk = recipients.slice(i, i + chunkSize);
        
        // Execute chunk concurrently
        const chunkResults = await Promise.allSettled(
          chunk.map((recipient) =>
            sendToRecipient(recipient.trim(), subject, body, files)
          )
        );
        results.push(...chunkResults);

        // If there are more emails left, pause for 1 second to pace it properly
        if (i + chunkSize < recipients.length) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      const summary = results.map((result, idx) => ({
        recipient: recipients[idx],
        status: result.status === 'fulfilled' ? 'sent' : 'failed',
        error: result.status === 'rejected' ? result.reason?.message : null,
      }));

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

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`✅ MultiMail server running on http://localhost:${PORT}`);
  console.log(`📧 Sending as: ${SMTP_USER}`);
});
