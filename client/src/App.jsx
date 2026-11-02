import { useState, useRef } from 'react';
import RecipientList from './components/RecipientList.jsx';
import EmailComposer from './components/EmailComposer.jsx';
import SendStatus from './components/SendStatus.jsx';

const SENDER_EMAIL = 'uttamg61001@gmail.com';

/** Find all unfilled [Placeholder] tokens in a string. */
function findPlaceholders(text) {
  const matches = text.match(/\[[^\]]+\]/g);
  if (!matches) return [];
  // Deduplicate
  return [...new Set(matches)];
}

export default function App() {
  const [recipients, setRecipients] = useState([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);
  const [placeholderError, setPlaceholderError] = useState('');

  const bodyRef = useRef(null);

  const canSend =
    recipients.length > 0 &&
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    !sending;

  async function handleSend() {
    setPlaceholderError('');

    // ── Placeholder check ────────────────────────────────────────────────────
    const found = [
      ...findPlaceholders(subject),
      ...findPlaceholders(body),
    ];
    // Deduplicate across both fields
    const unique = [...new Set(found)];
    if (unique.length > 0) {
      setPlaceholderError(
        `Please fill these before sending: ${unique.join(', ')}`,
      );
      // Focus the message field so the user sees where to edit
      bodyRef.current?.focus();
      return;
    }

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('subject', subject);
      // Send as plain text — the server handles HTML conversion & escaping
      formData.append('body', body);
      formData.append('recipients', JSON.stringify(recipients));
      attachments.forEach((file) => formData.append('attachments', file));

      const res = await fetch('/api/send', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      setResults(data.results || [{ recipient: 'unknown', status: 'failed', error: data.error }]);
    } catch (err) {
      setResults([{ recipient: 'Server Error', status: 'failed', error: err.message }]);
    } finally {
      setSending(false);
    }
  }

  function handleReset() {
    setResults(null);
    setRecipients([]);
    setSubject('');
    setBody('');
    setAttachments([]);
    setPlaceholderError('');
  }

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <span className="logo-icon">✉️</span>
        <h1>Uttam</h1>
        <p>Send private individual emails to multiple recipients — no one sees who else got it.</p>
      </header>

      {results ? (
        <SendStatus results={results} onReset={handleReset} />
      ) : (
        <main className="main-grid">
          {/* Sender */}
          <div className="card">
            <div className="card-title">🔐 Sending From</div>
            <div className="sender-badge">
              <div className="sender-avatar">U</div>
              <div className="sender-info">
                <div className="sender-name">Gmail Account</div>
                <div className="sender-email">{SENDER_EMAIL}</div>
              </div>
              <span className="sender-status">● Connected</span>
            </div>
          </div>

          {/* Recipients */}
          <div className="card">
            <div className="card-title">👥 Recipients</div>
            <RecipientList recipients={recipients} setRecipients={setRecipients} />
          </div>

          {/* Compose */}
          <div className="card">
            <div className="card-title">✍️ Compose Email</div>
            <EmailComposer
              subject={subject}
              setSubject={setSubject}
              body={body}
              setBody={setBody}
              attachments={attachments}
              setAttachments={setAttachments}
              bodyRef={bodyRef}
            />
          </div>

          {/* Send */}
          <div>
            {/* Placeholder error banner */}
            {placeholderError && (
              <div className="placeholder-error" role="alert">
                ⚠️ {placeholderError}
              </div>
            )}

            <button
              id="send-btn"
              className="btn-send"
              onClick={handleSend}
              disabled={!canSend}
            >
              {sending ? (
                <>
                  <div className="spinner" />
                  Sending to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}…
                </>
              ) : (
                <>
                  🚀 Send to {recipients.length || '—'} Recipient{recipients.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
            <p className="privacy-note">
              🔒 Each recipient receives a separate, private email — no CC, no BCC exposure
            </p>
          </div>
        </main>
      )}
    </div>
  );
}
