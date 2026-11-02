// ─── Constants ────────────────────────────────────────────────────────────────
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const VALID_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_EMAILS = 500;

/** Case-insensitive header names that identify an email column. */
const EMAIL_HEADER_NAMES = new Set([
  'email', 'emails', 'e-mail', 'e-mails', 'mail', 'email address', 'email addresses',
]);

// ─── Public helpers ───────────────────────────────────────────────────────────

export function isValidEmail(email) {
  return VALID_EMAIL_RE.test(String(email).trim());
}

/**
 * Clean a raw cell value before validation:
 *  - Trim whitespace
 *  - Remove surrounding quotes (single or double)
 *  - Strip leading "mailto:" prefix
 *  - Lowercase
 */
function cleanEmail(raw) {
  let s = String(raw ?? '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  if (s.toLowerCase().startsWith('mailto:')) {
    s = s.slice('mailto:'.length).trim();
  }
  return s.toLowerCase();
}

/**
 * Deduplicate while preserving order.
 * Returns { unique: string[], invalid: string[] }.
 *   unique  — valid, lowercased, de-duped emails
 *   invalid — non-empty strings that looked like they could be emails but weren't valid
 */
function partitionEmails(rawList) {
  const seen = new Set();
  const unique = [];
  const invalid = [];

  for (const raw of rawList) {
    const cleaned = cleanEmail(raw);
    if (!cleaned) continue;

    // Only flag as "invalid" if it has an @ (user probably intended an email)
    if (!isValidEmail(cleaned)) {
      if (cleaned.includes('@')) invalid.push(cleaned);
      continue;
    }

    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    unique.push(cleaned);
  }

  return { unique, invalid };
}

// ─── Format-specific extractors ───────────────────────────────────────────────

/**
 * Given an array-of-arrays table (rows × cols), find values that are (likely)
 * emails.
 *
 * Strategy:
 *  1. If row[0] contains a recognised email-column header, read only that column.
 *  2. If the table has exactly one column and no recognisable header, treat every
 *     non-empty cell as a candidate.
 *  3. Otherwise fall back to scanning all cells with the email regex.
 */
function extractFromTable(rows) {
  if (!rows.length) return [];

  const header = rows[0];
  const headerStr = String(header[0] ?? '').trim().toLowerCase();

  // 1. Named email column
  if (header.length > 0) {
    const emailColIdx = header.findIndex(
      (h) => EMAIL_HEADER_NAMES.has(String(h ?? '').trim().toLowerCase())
    );
    if (emailColIdx !== -1) {
      return rows.slice(1).map((row) => String(row[emailColIdx] ?? ''));
    }
  }

  // 2. Single column, no recognised header → treat every cell as a candidate
  const maxCols = Math.max(...rows.map((r) => r.length));
  if (maxCols <= 1) {
    // Include the first row too (no header — just emails)
    return rows.map((row) => String(row[0] ?? ''));
  }

  // 3. Full-file text scan (existing full-details format)
  const allText = rows.map((r) => r.join(' ')).join('\n');
  return (allText.match(EMAIL_REGEX) || []);
}

async function extractFromCsv(file) {
  const text = await file.text();

  // Parse into rows (simple split; handles quoted fields)
  const lines = text.split(/\r?\n/);
  const rows = lines
    .map((line) => {
      // Basic CSV split respecting double-quoted cells
      const cells = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          cells.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
      cells.push(current);
      return cells;
    })
    .filter((row) => row.some((cell) => cell.trim() !== ''));

  return extractFromTable(rows);
}

async function extractFromExcel(file) {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Read only the first sheet
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];

  // Parse as array-of-arrays (preserves column structure)
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return extractFromTable(rows);
}

async function extractFromPdf(file) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const parts = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    parts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }

  return (parts.join('\n').match(EMAIL_REGEX) || []);
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Parse a recipient list file and return a result object:
 *
 *   {
 *     emails:    string[]  // valid, unique, cleaned emails (capped at MAX_EMAILS)
 *     invalid:   string[]  // non-empty @-containing strings that failed validation
 *     capped:    boolean   // true when the file had more than MAX_EMAILS valid addresses
 *     totalValid: number   // total valid before the cap
 *   }
 *
 * Throws an Error with a user-facing message on bad file type or size.
 */
export async function extractEmailsFromFile(file) {
  // ── File size guard ──────────────────────────────────────────────────────
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 5 MB.`
    );
  }

  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  // ── Route by file type ───────────────────────────────────────────────────
  let rawCandidates;

  if (name.endsWith('.csv') || type === 'text/csv') {
    rawCandidates = await extractFromCsv(file);
  } else if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    type.includes('spreadsheet') ||
    type === 'application/vnd.ms-excel'
  ) {
    rawCandidates = await extractFromExcel(file);
  } else if (name.endsWith('.pdf') || type === 'application/pdf') {
    rawCandidates = await extractFromPdf(file);
  } else {
    throw new Error('Unsupported file type. Please upload a CSV, Excel (.xlsx / .xls), or PDF file.');
  }

  // ── Validate & deduplicate ───────────────────────────────────────────────
  const { unique, invalid } = partitionEmails(rawCandidates);

  const totalValid = unique.length;
  const capped = totalValid > MAX_EMAILS;
  const emails = capped ? unique.slice(0, MAX_EMAILS) : unique;

  return { emails, invalid, capped, totalValid };
}

/** @deprecated Use extractEmailsFromFile (returns object now). */
export function extractEmailsFromText(text) {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX) || [];
  return partitionEmails(matches).unique;
}

/** @deprecated */
export function uniqueEmails(emails) {
  return partitionEmails(emails).unique;
}
