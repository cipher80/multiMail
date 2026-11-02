import { useState, useEffect, useRef } from 'react';

const BUILT_IN_IDS = new Set(['full-time', 'part-time', 'contract', 'freelance']);

export default function TemplateSelector({ subject, body, onLoad }) {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Track the text that was last loaded from a template (to detect unsaved edits)
  const loadedRef = useRef({ subject: '', body: '' });

  // ── Fetch templates on mount ──────────────────────────────────────────────
  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/templates');
      if (!res.ok) throw new Error('Failed to load templates');
      setTemplates(await res.json());
    } catch (e) {
      setError('Could not load templates. Is the server running?');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getSelected() {
    return templates.find((t) => t.id === selectedId) || null;
  }

  function hasUnsavedEdits() {
    if (!selectedId) return false;
    return (
      subject !== loadedRef.current.subject ||
      body !== loadedRef.current.body
    );
  }

  function applyTemplate(tpl) {
    loadedRef.current = { subject: tpl.subject, body: tpl.body };
    onLoad({ subject: tpl.subject, body: tpl.body });
    clearMessages();
  }

  function clearMessages() {
    setError('');
    setSaveError('');
    setSaveSuccess('');
  }

  // ── Select template ───────────────────────────────────────────────────────
  function handleSelect(e) {
    const newId = e.target.value;
    if (!newId) {
      setSelectedId('');
      return;
    }
    if (hasUnsavedEdits()) {
      const ok = window.confirm(
        'You have unsaved changes. Replace them with the selected template?',
      );
      if (!ok) {
        // Revert the <select> visually
        e.target.value = selectedId;
        return;
      }
    }
    const tpl = templates.find((t) => t.id === newId);
    if (tpl) {
      setSelectedId(newId);
      applyTemplate(tpl);
    }
  }

  // ── Reset built-in ────────────────────────────────────────────────────────
  function handleReset() {
    const tpl = getSelected();
    if (!tpl) return;
    applyTemplate(tpl);
    setSaveSuccess('Template reset to its original text.');
  }

  // ── Save as new template ──────────────────────────────────────────────────
  async function handleSaveNew() {
    clearMessages();
    const name = window.prompt('Enter a name for this template (max 50 characters):');
    if (name === null) return; // cancelled
    const trimmed = name.trim();
    if (!trimmed) { setSaveError('Name is required.'); return; }
    if (trimmed.length > 50) { setSaveError('Name must be 50 characters or fewer.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error || 'Save failed.'); return; }
      await fetchTemplates();
      setSelectedId(data.id);
      loadedRef.current = { subject, body };
      setSaveSuccess(`Template "${trimmed}" saved.`);
    } catch (e) {
      setSaveError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  // ── Update custom template ────────────────────────────────────────────────
  async function handleUpdate() {
    clearMessages();
    const tpl = getSelected();
    if (!tpl) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(tpl.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tpl.name, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error || 'Update failed.'); return; }
      await fetchTemplates();
      loadedRef.current = { subject, body };
      setSaveSuccess(`Template "${tpl.name}" updated.`);
    } catch (e) {
      setSaveError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  // ── Delete custom template ────────────────────────────────────────────────
  async function handleDelete() {
    clearMessages();
    const tpl = getSelected();
    if (!tpl) return;
    const ok = window.confirm(`Delete template "${tpl.name}"? This cannot be undone.`);
    if (!ok) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(tpl.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error || 'Delete failed.'); return; }
      await fetchTemplates();
      setSelectedId('');
      loadedRef.current = { subject: '', body: '' };
      setSaveSuccess('Template deleted.');
    } catch (e) {
      setSaveError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const selected = getSelected();
  const isBuiltIn = selected ? BUILT_IN_IDS.has(selected.id) : false;
  const builtIns  = templates.filter((t) => BUILT_IN_IDS.has(t.id));
  const customs   = templates.filter((t) => !BUILT_IN_IDS.has(t.id));

  return (
    <div className="template-selector">
      {/* Row: dropdown + save-new button */}
      <div className="template-top-row">
        <div className="template-select-wrap">
          <span className="template-select-icon">📋</span>
          <select
            id="template-select"
            className="template-select"
            value={selectedId}
            onChange={handleSelect}
            disabled={loading}
          >
            <option value="">Select template…</option>
            <optgroup label="Built-in">
              {builtIns.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </optgroup>
            {customs.length > 0 && (
              <optgroup label="Custom">
                {customs.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <button
          id="save-new-template-btn"
          className="btn-tpl btn-tpl-save"
          onClick={handleSaveNew}
          disabled={loading}
          title="Save current subject & message as a new template"
        >
          {loading ? <span className="tpl-spinner" /> : '＋'}
          Save as template
        </button>
      </div>

      {/* Context action buttons (only when a template is selected) */}
      {selected && (
        <div className="template-actions">
          {isBuiltIn ? (
            <button
              id="reset-template-btn"
              className="btn-tpl btn-tpl-ghost"
              onClick={handleReset}
              disabled={loading}
            >
              ↺ Reset to default
            </button>
          ) : (
            <>
              <button
                id="update-template-btn"
                className="btn-tpl btn-tpl-ghost"
                onClick={handleUpdate}
                disabled={loading}
              >
                {loading ? <span className="tpl-spinner" /> : '↑'}
                Update template
              </button>
              <button
                id="delete-template-btn"
                className="btn-tpl btn-tpl-danger"
                onClick={handleDelete}
                disabled={loading}
              >
                🗑 Delete template
              </button>
            </>
          )}
        </div>
      )}

      {/* Feedback messages */}
      {error      && <p className="tpl-msg tpl-msg-error">{error}</p>}
      {saveError  && <p className="tpl-msg tpl-msg-error">{saveError}</p>}
      {saveSuccess && <p className="tpl-msg tpl-msg-success">{saveSuccess}</p>}
    </div>
  );
}
