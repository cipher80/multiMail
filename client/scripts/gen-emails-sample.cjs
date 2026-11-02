/**
 * gen-emails-sample.cjs
 * Run once from the multiMail root:
 *   node client/scripts/gen-emails-sample.cjs
 *
 * Writes client/samples/emails-only-sample.xlsx
 */
const path = require('path');
const XLSX = require('xlsx');

const rows = [
  ['email'],
  ['hr@example.com'],
  ['careers@example.com'],
  ['recruiter@example.com'],
  ['hiring@example.com'],
  ['talent@example.com'],
];

const ws = XLSX.utils.aoa_to_sheet(rows);
// Auto-size the single column
ws['!cols'] = [{ wch: 28 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Emails');

const outPath = path.join(__dirname, '..', 'samples', 'emails-only-sample.xlsx');
XLSX.writeFile(wb, outPath);
console.log('✅  Written:', outPath);
