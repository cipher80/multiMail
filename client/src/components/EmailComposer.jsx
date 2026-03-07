import { useRef, useState } from 'react';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file) {
  if (file.type === 'application/pdf') return '📄';
  if (file.type.startsWith('image/')) return '🖼️';
  if (file.type.includes('word')) return '📝';
  if (file.type.includes('excel') || file.type.includes('spreadsheet')) return '📊';
  if (file.type.includes('zip') || file.type.includes('rar')) return '🗜️';
  return '📎';
}

export default function EmailComposer({
  subject, setSubject,
  body, setBody,
  attachments, setAttachments,
}) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(files) {
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    const validFiles = Array.from(files).filter((f) => {
      if (f.size > MAX_SIZE) {
        alert(`"${f.name}" exceeds 25MB limit and was skipped.`);
        return false;
      }
      return true;
    });
    // Avoid duplicates by name
    const existing = new Set(attachments.map((a) => a.name));
    const newFiles = validFiles.filter((f) => !existing.has(f.name));
    setAttachments([...attachments, ...newFiles]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function removeAttachment(name) {
    setAttachments(attachments.filter((f) => f.name !== name));
  }

  return (
    <div>
      {/* Subject */}
      <div className="field">
        <label htmlFor="subject-input">Subject</label>
        <input
          id="subject-input"
          type="text"
          placeholder="Email subject…"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </div>

      {/* Body */}
      <div className="field">
        <label htmlFor="body-input">Message</label>
        <textarea
          id="body-input"
          className="email-body"
          placeholder="Write your message here…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      {/* Attachments */}
      <div className="field">
        <label>Attachments <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional · max 25 MB per file)</span></label>
        <div
          className={`file-drop-zone${dragOver ? ' drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            id="file-input"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.zip"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <span className="drop-icon">📎</span>
          <p className="drop-label">
            Drag &amp; drop files here, or <span>click to browse</span>
          </p>
          <p className="drop-hint">PDF, images, Office documents, ZIP — up to 25 MB each</p>
        </div>

        {attachments.length > 0 && (
          <div className="attached-files">
            {attachments.map((file) => (
              <div className="file-chip" key={file.name}>
                <div className="file-chip-left">
                  <span className="file-icon">{getFileIcon(file)}</span>
                  <div>
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">{formatBytes(file.size)}</div>
                  </div>
                </div>
                <button
                  className="btn-remove"
                  onClick={() => removeAttachment(file.name)}
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
