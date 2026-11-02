import { useRef, useState } from 'react';
import { extractEmailsFromFile, isValidEmail } from '../utils/extractEmails.js';

// ─── Sample download helper ───────────────────────────────────────────────────
function SampleDownloads() {
  return (
    <div className="sample-downloads">
      <span className="sample-downloads-label">Download sample:</span>
      <div className="sample-downloads-links">
        <div className="sample-group">
          <span className="sample-group-name">Full HR details</span>
          <a
            id="dl-full-csv"
            href="/samples/recipients-sample.csv"
            download="recipients-sample.csv"
            className="sample-link"
          >
            CSV
          </a>
        </div>
        <span className="sample-divider" aria-hidden="true">·</span>
        <div className="sample-group">
          <span className="sample-group-name">Emails only</span>
          <a
            id="dl-emails-csv"
            href="/samples/emails-only-sample.csv"
            download="emails-only-sample.csv"
            className="sample-link"
          >
            CSV
          </a>
          <a
            id="dl-emails-xlsx"
            href="/samples/emails-only-sample.xlsx"
            download="emails-only-sample.xlsx"
            className="sample-link"
          >
            Excel
          </a>
        </div>
      </div>
      <p className="sample-hint">
        Upload a file with just HR email addresses, one per row. They will be added to your
        recipient list automatically.
      </p>
    </div>
  );
}

// ─── Invalid-entries disclosure ───────────────────────────────────────────────
function InvalidList({ entries }) {
  const [open, setOpen] = useState(false);
  if (!entries.length) return null;
  return (
    <div className="invalid-disclosure">
      <button
        type="button"
        className="invalid-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="invalid-toggle-icon">{open ? '▾' : '▸'}</span>
        Show {entries.length} invalid entr{entries.length === 1 ? 'y' : 'ies'}
      </button>
      {open && (
        <ul className="invalid-list">
          {entries.map((e, i) => (
            <li key={i} className="invalid-item">{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RecipientList({ recipients, setRecipients }) {
  const [mode, setMode] = useState('manual'); // 'manual' | 'upload'
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [invalidEntries, setInvalidEntries] = useState([]);
  const fileInputRef = useRef(null);

  // ── Manual add ─────────────────────────────────────────────────────────────
  function addRecipient() {
    const email = input.trim();
    if (!email) return;
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (recipients.some((r) => r.toLowerCase() === email.toLowerCase())) {
      setError('This email is already in the list.');
      return;
    }
    setRecipients([...recipients, email]);
    setInput('');
    setError('');
    setInfo('');
    setInvalidEntries([]);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRecipient();
    }
  }

  function removeRecipient(email) {
    setRecipients(recipients.filter((r) => r !== email));
  }

  // ── Merge helpers ──────────────────────────────────────────────────────────
  function mergeRecipients(emails) {
    const existing = new Set(recipients.map((r) => r.toLowerCase()));
    const added = [];
    for (const email of emails) {
      const key = email.toLowerCase();
      if (existing.has(key)) continue;
      existing.add(key);
      added.push(email);
    }
    if (added.length) {
      setRecipients([...recipients, ...added]);
    }
    return { added: added.length, skipped: emails.length - added.length };
  }

  // ── File handling ──────────────────────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return;
    setError('');
    setInfo('');
    setInvalidEntries([]);
    setImporting(true);

    try {
      const result = await extractEmailsFromFile(file);
      const { emails, invalid, capped, totalValid } = result;

      if (!emails.length && !invalid.length) {
        setError(
          'No valid email addresses found in this file. Check the format or download the sample.'
        );
        return;
      }

      if (!emails.length) {
        setError(
          'No valid email addresses found in this file. Check the format or download the sample.'
        );
        setInvalidEntries(invalid);
        return;
      }

      const { added, skipped } = mergeRecipients(emails);

      // Build summary message
      const parts = [];
      if (added > 0) parts.push(`${added} email${added !== 1 ? 's' : ''} added`);
      else parts.push('No new emails added (all were already in the list)');
      if (skipped > 0) parts.push(`${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped`);
      if (invalid.length > 0) parts.push(`${invalid.length} invalid skipped`);
      if (capped) parts.push(`(file had ${totalValid} valid — capped at 500)`);

      setInfo(parts.join(' · '));
      setInvalidEntries(invalid);
    } catch (err) {
      setError(err.message || 'Failed to read file. Please try again.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function onFileChange(e) {
    handleFile(e.target.files?.[0]);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setInfo('');
    setInvalidEntries([]);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Mode tabs */}
      <div className="recipient-mode-tabs" role="tablist" aria-label="How to add recipients">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'manual'}
          className={`recipient-mode-tab${mode === 'manual' ? ' active' : ''}`}
          onClick={() => switchMode('manual')}
        >
          Add one by one
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'upload'}
          className={`recipient-mode-tab${mode === 'upload' ? ' active' : ''}`}
          onClick={() => switchMode('upload')}
        >
          Upload file
        </button>
      </div>

      {mode === 'manual' ? (
        <div className="recipient-input-row">
          <input
            id="recipient-input"
            type="email"
            placeholder="Enter recipient email address…"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
          />
          <button id="add-recipient-btn" className="btn-add" onClick={addRecipient}>
            + Add
          </button>
        </div>
      ) : (
        <>
          {/* Sample downloads */}
          <SampleDownloads />

          {/* Drop zone */}
          <div
            className={`file-drop-zone recipient-upload-zone${dragOver ? ' drag-over' : ''}${importing ? ' importing' : ''}`}
            onClick={() => !importing && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.pdf,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              hidden
              onChange={onFileChange}
              disabled={importing}
            />
            <div className="drop-icon">{importing ? '⏳' : '📄'}</div>
            <p className="drop-title">
              {importing ? 'Reading file…' : 'Drop CSV, Excel, or PDF here'}
            </p>
            <p className="drop-hint">
              Emails are detected automatically — works with emails-only files or full HR sheets
            </p>
          </div>
        </>
      )}

      {/* Feedback */}
      {error && (
        <p id="recipient-error" className="recipient-feedback recipient-feedback-error">
          ⚠ {error}
        </p>
      )}
      {info && !error && (
        <p id="recipient-info" className="recipient-feedback recipient-feedback-info">
          ✓ {info}
        </p>
      )}

      {/* Invalid entries disclosure */}
      {invalidEntries.length > 0 && <InvalidList entries={invalidEntries} />}

      {/* Recipient list */}
      {recipients.length === 0 ? (
        <div className="empty-recipients">
          No recipients yet — add emails one by one or upload a file
        </div>
      ) : (
        <div className="recipients-list">
          {recipients.map((email, i) => (
            <div
              className="recipient-chip"
              key={email}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <span className="chip-email">{email}</span>
              <button
                className="btn-remove"
                onClick={() => removeRecipient(email)}
                title="Remove recipient"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {recipients.length > 0 && (
        <p className="recipient-count">
          {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} will each receive a separate private email
        </p>
      )}
    </div>
  );
}
