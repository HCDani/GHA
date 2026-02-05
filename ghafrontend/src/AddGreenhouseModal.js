import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { extractGrafanaUrl, normalizeGrafanaUrl } from './utils/grafanaUrl';
import './styles/App.css';

try {
  Modal.setAppElement('#root');
} catch (err) {
  // ignore in non-browser environments
}

export default function AddGreenhouseModal({ open, onClose, onSave, initial = {}, availableOrders = [] }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState(0);
  const [grafanaUrl, setGrafanaUrl] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setTitle(initial.title || '');
      setDescription(initial.description || '');
      setOrder(initial.order ?? 0);
      const gd = initial.grafanadata;
      if (gd && Array.isArray(gd)) {
        setGrafanaUrl(gd[0].grafanaURL);
      } else {
        setGrafanaUrl('');
      }
      setErrors({});
    }
  }, [open, initial]);

  function validate() {
    const out = {};
    if (!title || !title.toString().trim()) out.title = 'Title is required.';
    if (grafanaUrl && grafanaUrl.toString().trim()) {
      const extracted = extractGrafanaUrl(grafanaUrl);
      if (extracted && !normalizeGrafanaUrl(extracted)) {
        out.grafanaUrl = 'Invalid URL. Paste the iframe src or a full URL.';
      }
    }
    return out;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const v = validate();
    if (Object.keys(v).length) {
      setErrors(v);
      return;
    }
    setErrors({});
    
    // Build grafanadata: [{ grafanaURL, panel_width: 350, panel_height: 200 }, ...]
    let grafanadata = [];
    if (grafanaUrl && grafanaUrl.toString().trim()) {
      const normalized = normalizeGrafanaUrl(grafanaUrl, { addTimeRange: true });
      grafanadata.push({
        grafanaURL: normalized || extractGrafanaUrl(grafanaUrl),
        panel_width: 350,
        panel_height: 200,
      });
    }
    onSave({ title: title || 'Untitled', description, order, grafanadata });
  }

  function handleGrafanaChange(e) {
    let v = e.target.value || '';
    v = v.trim();
    // Don't extract src here - let handleSubmit do it after splitting by comma
    // This allows multiple iframe tags to be pasted
    setGrafanaUrl(v);
  }

  const isEdit = !!(initial && (initial.id || initial.id === 0));
  const header = isEdit ? 'Edit greenhouse' : 'Add a new greenhouse';

  return (
    <Modal
      isOpen={open}
      onRequestClose={onClose}
      overlayClassName="modal-overlay"
      className="modal"
      contentLabel={header}
    >
      <h3>{header}</h3>
      <form onSubmit={handleSubmit} className="modal-form">
        <label className={errors.title ? 'field-error' : ''}>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
          {errors.title && <span className="error-text">{errors.title}</span>}
        </label>

        <label>
          Description (max 100 characters)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={100} />
        </label>
        {isEdit && (
          <label>
            Order
            <select value={order} onChange={(e) => setOrder(parseInt(e.target.value) || 0)}>
              {availableOrders.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={errors.grafanaUrl ? 'field-error' : ''}>
          Grafana panel URLs (iframe src)
          <input
            value={grafanaUrl}
            onChange={handleGrafanaChange}
            placeholder="Paste iframe tag or src URL"
          />
          <small>Paste full &lt;iframe&gt; tag or the `src` URL — we extract the URL.</small>
          {errors.grafanaUrl && <span className="error-text">{errors.grafanaUrl}</span>}
        </label>

        {grafanaUrl && (
          <div className="grafana-preview">
            <small>Preview:</small>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {grafanaUrl.split(',').map((part, idx) => {
                const src = extractGrafanaUrl(part.trim());
                return <iframe key={idx} title={`grafana-preview-${idx}`} src={src} width="300" height="150" frameBorder="0" />;
              })}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
