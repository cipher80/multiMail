import { useRef, useState } from 'react';
import { extractEmailsFromFile, isValidEmail } from '../utils/extractEmails.js';

export default function RecipientList({ recipients, setRecipients }) {
  const [mode, setMode] = useState('manual'); // 'manual' | 'upload'
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

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

  async function handleFile(file) {
    if (!file) return;
    setError('');
    setInfo('');
    setImporting(true);
    try {
      const emails = await extractEmailsFromFile(file);
      if (!emails.length) {
        setError('No valid email addresses found in that file.');
        return;
      }
      const { added, skipped } = mergeRecipients(emails);
      if (added === 0) {
        setInfo(`Found ${emails.length} email(s), but all were already in the list.`);
      } else {
        setInfo(
          `Imported ${added} recipient${added !== 1 ? 's' : ''} from ${file.name}` +
            (skipped ? ` (${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped)` : '')
        );
      }
    } catch (err) {
      setError(err.message || 'Failed to read file.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    handleFile(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }

  return (
    <div>
      <div className="recipient-mode-tabs" role="tablist" aria-label="How to add recipients">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'manual'}
          className={`recipient-mode-tab${mode === 'manual' ? ' active' : ''}`}
          onClick={() => { setMode('manual'); setError(''); setInfo(''); }}
        >
          Add one by one
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'upload'}
          className={`recipient-mode-tab${mode === 'upload' ? ' active' : ''}`}
          onClick={() => { setMode('upload'); setError(''); setInfo(''); }}
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
            Emails are detected automatically from any column or page text
          </p>
        </div>
      )}

      {error && (
        <p className="recipient-feedback recipient-feedback-error">
          ⚠ {error}
        </p>
      )}
      {info && !error && (
        <p className="recipient-feedback recipient-feedback-info">
          ✓ {info}
        </p>
      )}

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
