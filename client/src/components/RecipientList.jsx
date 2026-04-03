import { useState, useRef } from 'react';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function RecipientList({ recipients, setRecipients }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef(null);

  async function handlePDFUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const res = await fetch('/api/extract-emails', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to extract emails');

      const foundEmails = data.emails || [];
      if (foundEmails.length === 0) {
        setError('No valid email addresses found in the PDF.');
        return;
      }

      // Merge and deduplicate with existing recipients
      const newRecipients = [...recipients];
      let addedCount = 0;
      foundEmails.forEach(email => {
        if (!newRecipients.includes(email)) {
          newRecipients.push(email);
          addedCount++;
        }
      });

      setRecipients(newRecipients);
      if (addedCount === 0) {
        setError('All emails found in the PDF are already in the list.');
      } else {
        // Flash a slight success message? or just reset error
        setError(`Successfully added ${addedCount} emails from PDF!`);
        setTimeout(() => setError(''), 4000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsExtracting(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function addRecipient() {
    const email = input.trim();
    if (!email) return;
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (recipients.includes(email)) {
      setError('This email is already in the list.');
      return;
    }
    setRecipients([...recipients, email]);
    setInput('');
    setError('');
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

  return (
    <div>
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

      <div className="pdf-upload-row" style={{ marginTop: '12px', marginBottom: '12px' }}>
        <input
          type="file"
          accept="application/pdf"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handlePDFUpload}
        />
        <button
          className="btn-upload-pdf"
          onClick={() => fileInputRef.current?.click()}
          disabled={isExtracting}
          style={{
             padding: '8px 16px',
             background: 'var(--bg-card-hover)',
             color: 'var(--accent)',
             border: '1px solid var(--border)',
             boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
             borderRadius: '6px',
             cursor: isExtracting ? 'not-allowed' : 'pointer',
             fontSize: '0.9rem',
             display: 'flex',
             alignItems: 'center',
             gap: '6px'
          }}
        >
          {isExtracting ? '⏳ Extracting...' : '📄 Auto-Add Emails from PDF'}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: '0.8rem', color: 'var(--red)', marginBottom: '12px' }}>
          ⚠ {error}
        </p>
      )}

      {recipients.length === 0 ? (
        <div className="empty-recipients">
          No recipients yet — add email addresses above
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
