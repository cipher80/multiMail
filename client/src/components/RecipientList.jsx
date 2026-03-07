import { useState } from 'react';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function RecipientList({ recipients, setRecipients }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

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
