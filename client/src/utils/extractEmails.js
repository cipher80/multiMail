const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Deduplicate while preserving order; normalize to lowercase for comparison only in uniqueness. */
export function uniqueEmails(emails) {
  const seen = new Set();
  const out = [];
  for (const raw of emails) {
    const email = String(raw).trim();
    if (!email || !isValidEmail(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

export function extractEmailsFromText(text) {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX) || [];
  return uniqueEmails(matches);
}

async function extractFromCsv(file) {
  const text = await file.text();
  return extractEmailsFromText(text);
}

async function extractFromExcel(file) {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const chunks = [];

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    for (const row of rows) {
      chunks.push(row.join(' '));
    }
    // Also scan raw cell strings for emails embedded in longer text
    chunks.push(XLSX.utils.sheet_to_csv(sheet));
  }

  return extractEmailsFromText(chunks.join('\n'));
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

  return extractEmailsFromText(parts.join('\n'));
}

/**
 * Parse a recipient list file (.csv, .xlsx/.xls, .pdf) and return unique emails.
 */
export async function extractEmailsFromFile(file) {
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  if (name.endsWith('.csv') || type === 'text/csv') {
    return extractFromCsv(file);
  }

  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    type.includes('spreadsheet') ||
    type === 'application/vnd.ms-excel'
  ) {
    return extractFromExcel(file);
  }

  if (name.endsWith('.pdf') || type === 'application/pdf') {
    return extractFromPdf(file);
  }

  throw new Error('Unsupported file type. Use CSV, Excel (.xlsx/.xls), or PDF.');
}

export { isValidEmail };
