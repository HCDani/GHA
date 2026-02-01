import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pb } from '../pbClient';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import { normalizeGrafanaUrl } from '../utils/grafanaUrl';
import GrafanaPanelIframe from '../components/GrafanaPanelIframe';
import '../styles/GreenhouseDetailPage.css';

/** Max panel height (px) to treat as "small" and pack next to others on the same row when they fit. */
const SMALL_PANEL_MAX_HEIGHT = 320;
const PANELS_ROW_GAP = 32;

/**
 * Build rows of panels so that small (short) panels sit next to each other when they fit in width,
 * regardless of original order. Tall panels each get their own row.
 * @param {Array} panels - list of panel objects
 * @param {Object} panelSizes - map idx -> { width, height }
 * @param {number} containerWidth - available width for a row (px)
 * @returns {Array<Array<{idx: number, width: number, height: number}>>} rows, each row is an array of items
 */
function computePanelLayout(panels, panelSizes, containerWidth) {
  if (!panels.length) return [];
  const withSizes = panels.map((_, idx) => {
    const size = panelSizes[idx] || { width: 1000, height: 400 };
    return { idx, width: size.width, height: size.height };
  });
  const small = withSizes.filter(({ height }) => height <= SMALL_PANEL_MAX_HEIGHT);
  const tall = withSizes.filter(({ height }) => height > SMALL_PANEL_MAX_HEIGHT);

  const rows = [];
  let currentRow = [];
  let currentRowWidth = 0;

  for (const item of small) {
    const gap = currentRow.length > 0 ? PANELS_ROW_GAP : 0;
    const needWidth = item.width + gap;
    if (currentRow.length > 0 && currentRowWidth + needWidth > containerWidth) {
      rows.push(currentRow);
      currentRow = [];
      currentRowWidth = 0;
    }
    currentRow.push(item);
    currentRowWidth += item.width + (currentRow.length > 1 ? PANELS_ROW_GAP : 0);
  }
  if (currentRow.length > 0) rows.push(currentRow);

  tall.forEach((item) => rows.push([item]));
  return rows;
}

export default function GreenhouseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [greenhouse, setGreenhouse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [panels, setPanels] = useState([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newPanelUrl, setNewPanelUrl] = useState('');
  const [panelSizes, setPanelSizes] = useState({});
  const [editingPanelIdx, setEditingPanelIdx] = useState(null);
  const [editingPanelName, setEditingPanelName] = useState('');
  const [editingPanelUrl, setEditingPanelUrl] = useState('');
  const [editingPanelWidth, setEditingPanelWidth] = useState('');
  const [editingPanelHeight, setEditingPanelHeight] = useState('');
  const [gridWidth, setGridWidth] = useState(1200);
  const panelsGridRef = useRef(null);

  useEffect(() => {
    loadGreenhouse();
  }, [id, user]);

  useEffect(() => {
    const el = panelsGridRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0]?.contentRect ?? {};
      if (typeof width === 'number' && width > 0) setGridWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [panels.length]);

  // Build grafanaData array for PocketBase: [{ grafanaURL, panel_width, panel_height }, ...]
  function buildGrafanaData(panelsList, sizes) {
    return panelsList
      .filter(p => p && p.url)
      .map((p, idx) => ({
        grafanaURL: p.url,
        panel_width: (sizes[idx] && sizes[idx].width) || 350,
        panel_height: (sizes[idx] && sizes[idx].height) || 200,
      }));
  }

  async function loadGreenhouse() {
    if (!user) return;
    setIsLoading(true);
    try {
      const record = await pb.collection(`${user.id}_greenhouses`).getOne(id);
      const raw = record.grafanadata;
      let grafanaData = [];
      if (raw != null) {
        try {
          grafanaData = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!Array.isArray(grafanaData)) grafanaData = [];
        } catch (e) {
          console.warn('Failed to parse grafanaData', e);
        }
      }

      const mapped = {
        id: record.id,
        title: record.title || '',
        description: record.description || '',
        order: record.order ?? 0,
      };
      setGreenhouse(mapped);
      setEditedTitle(mapped.title);
      setEditedDescription(mapped.description);

      // Build panels and panelSizes from grafanaData
      const allPanels = [];
      const initialSizes = {};
      grafanaData.forEach((item, idx) => {
        const url = item && (item.grafanaURL);
        if (!url) return;
        allPanels.push({
          id: `panel-${idx}`,
          name: idx === 0 ? 'Primary Panel' : `Panel ${idx + 1}`,
          url,
        });
        initialSizes[idx] = {
          width: (item.panel_width != null ? item.panel_width : 350),
          height: (item.panel_height != null ? item.panel_height : 200),
        };
      });
      setPanels(allPanels);
      setPanelSizes(initialSizes);
    } catch (err) {
      console.error('Failed to load greenhouse details', err);
      toast.error('Failed to load greenhouse details');
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddPanel() {
    if (!newPanelUrl.trim()) {
      toast.error('Please enter a panel URL');
      return;
    }

    const processedUrl = normalizeGrafanaUrl(newPanelUrl.trim(), { addTimeRange: true });
    if (!processedUrl) {
      toast.error(`Invalid URL: ${newPanelUrl.trim()}`);
      return;
    }

    const newPanelToAdd = {
      id: `panel-${Date.now()}`,
      name: `Panel ${panels.length + 1}`,
      url: processedUrl,
    };

    const updatedPanels = [...panels, newPanelToAdd];
    setPanels(updatedPanels);
    setPanelSizes((prev) => {
      const newSizes = { ...prev };
      newSizes[panels.length] = { width: 350, height: 200 };
      return newSizes;
    });
    
    setNewPanelUrl('');
    setShowAddPanel(false);

    // Save to database
    if (greenhouse) {
      try {
        const grafanaData = buildGrafanaData(updatedPanels, panelSizes);
        const updateData = {
          title: greenhouse.title,
          description: greenhouse.description,
          order: greenhouse.order,
          grafanadata: grafanaData,
        };
        await pb.collection(`${user.id}_greenhouses`).update(id, updateData);
        // Reload to verify the save worked
        await loadGreenhouse();
        toast.success(`panel added`);
      } catch (err) {
        console.error('Failed to save panel', err);
        toast.error('Failed to save panel');
      }
    }
  }

  async function handleRemovePanel(idx) {
    const newPanels = panels.filter((_, i) => i !== idx);
    setPanels(newPanels);
    
    const newSizes = {};
    newPanels.forEach((_, i) => {
      const originalIdx = i < idx ? i : i + 1;
      newSizes[i] = panelSizes[originalIdx];
    });
    setPanelSizes(newSizes);

    if (greenhouse) {
      try {
        const grafanaData = buildGrafanaData(newPanels, newSizes);
        await pb.collection(`${user.id}_greenhouses`).update(id, {
          title: greenhouse.title,
          description: greenhouse.description,
          order: greenhouse.order,
          grafanadata: grafanaData,
        });
        toast.success('Panel removed');
      } catch (err) {
        console.error('Failed to remove panel', err);
        toast.error('Failed to remove panel');
      }
    }
  }

  async function updatePanelSize(idx, dimension, value) {
    const newSize = Math.max(200, parseInt(value) || 200);
    const updatedSizes = {
      ...panelSizes,
      [idx]: { ...panelSizes[idx], [dimension]: newSize },
    };
    setPanelSizes(updatedSizes);

    if (greenhouse) {
      try {
        const grafanaData = buildGrafanaData(panels, updatedSizes);
        await pb.collection(`${user.id}_greenhouses`).update(id, {
          title: greenhouse.title,
          description: greenhouse.description,
          order: greenhouse.order,
          grafanadata: grafanaData,
        });
      } catch (err) {
        console.error('Failed to save panel sizes', err);
      }
    }
  }

  function startEditPanel(idx) {
    setEditingPanelIdx(idx);
    setEditingPanelName(panels[idx].name || '');
    setEditingPanelUrl(panels[idx].url);
    const currentSize = panelSizes[idx] || { width: 350, height: 200 };
    setEditingPanelWidth(currentSize.width.toString());
    setEditingPanelHeight(currentSize.height.toString());
  }

  function getMaxDimensions() {
    // Get viewport dimensions and set max sizes
    const maxWidth = Math.min(window.innerWidth - 100, 1920); // Leave some margin, cap at 1920px
    const maxHeight = Math.min(window.innerHeight - 200, 1080); // Leave space for header, cap at 1080px
    return { maxWidth, maxHeight };
  }

  async function saveEditedPanel() {
    if (!editingPanelUrl.trim()) {
      toast.error('Please enter a panel URL');
      return;
    }

    const url = normalizeGrafanaUrl(editingPanelUrl.trim(), { addTimeRange: true });
    if (!url) {
      toast.error('Invalid URL');
      return;
    }

    // Validate and save sizes before closing edit mode
    const { maxWidth, maxHeight } = getMaxDimensions();
    const widthValue = parseInt(editingPanelWidth) || 200;
    const heightValue = parseInt(editingPanelHeight) || 200;
    const clampedWidth = Math.min(Math.max(200, widthValue), maxWidth);
    const clampedHeight = Math.min(Math.max(200, heightValue), maxHeight);
    
    // Update sizes immediately
    updatePanelSize(editingPanelIdx, 'width', clampedWidth);
    updatePanelSize(editingPanelIdx, 'height', clampedHeight);

    const newPanels = panels.map((panel, idx) => {
      if (idx === editingPanelIdx) {
        return {
          ...panel,
          name: editingPanelName || panel.name,
          url: url,
        };
      }
      return panel;
    });

    setPanels(newPanels);
    setEditingPanelIdx(null);
    setEditingPanelWidth('');
    setEditingPanelHeight('');

    if (greenhouse) {
      try {
        const grafanaData = buildGrafanaData(newPanels, panelSizes);
        await pb.collection(`${user.id}_greenhouses`).update(id, {
          title: greenhouse.title,
          description: greenhouse.description,
          order: greenhouse.order,
          grafanadata: grafanaData,
        });
        toast.success('Panel updated');
      } catch (err) {
        console.error('Failed to update panel', err);
        toast.error('Failed to update panel');
      }
    }
  }

  function cancelEditPanel() {
    setEditingPanelIdx(null);
    setEditingPanelName('');
    setEditingPanelUrl('');
    setEditingPanelWidth('');
    setEditingPanelHeight('');
  }

  async function handleSaveGreenhouse() {
    if (!editedTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSaving(true);
    try {
      const grafanaData = buildGrafanaData(panels, panelSizes);
      await pb.collection(`${user.id}_greenhouses`).update(id, {
        title: editedTitle,
        description: editedDescription,
        order: greenhouse.order,
        grafanadata: grafanaData,
      });
      
      setGreenhouse({
        ...greenhouse,
        title: editedTitle,
        description: editedDescription,
      });
      setIsEditing(false);
      toast.success('Greenhouse updated');
    } catch (err) {
      console.error('Failed to save greenhouse', err);
      toast.error('Failed to save greenhouse');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <div className="detail-page-loading">Loading greenhouse details...</div>;
  }

  if (!greenhouse) {
    return <div className="detail-page-error">Greenhouse not found</div>;
  }

  return (
    <div className="greenhouse-detail-page">
      <header className="detail-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Back to Greenhouses
        </button>
        <div className="detail-title-section">
          <h1>{greenhouse.title}</h1>
          <p className="detail-order">Order: {greenhouse.order}</p>
        </div>
      </header>

      <main className="detail-content">
        <section className="greenhouse-info">
          <div className="info-header">
            <h2>Details</h2>
            {!isEditing && (
              <button
                className="edit-btn"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="edit-form">
              <div className="form-group">
                <label htmlFor="title">Title</label>
                <input
                  id="title"
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  placeholder="Greenhouse title"
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description (max 100 characters)</label>
                <textarea
                  id="description"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Greenhouse description"
                  maxLength={100}
                  rows="4"
                />
              </div>
              <div className="form-actions">
                <button
                  className="btn secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedTitle(greenhouse.title);
                    setEditedDescription(greenhouse.description);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  className="btn primary"
                  onClick={handleSaveGreenhouse}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="info-display">
              <p className="description">
                {greenhouse.description || <em>No description provided</em>}
              </p>
            </div>
          )}
        </section>

        <section className="panels-section">
          <div className="panels-header">
            <h2>Grafana Panels</h2>
            <button
              className="add-panel-btn"
              onClick={() => setShowAddPanel(!showAddPanel)}
            >
              {showAddPanel ? 'Cancel' : '+ Add Panel'}
            </button>
          </div>

          {showAddPanel && (
            <div className="add-panel-form">
              <textarea
                value={newPanelUrl}
                onChange={(e) => setNewPanelUrl(e.target.value)}
                placeholder="Paste full <iframe> tag or the iframe src URL"
                rows="3"
              />
              <button className="btn primary" onClick={handleAddPanel}>
                Add Panel
              </button>
            </div>
          )}

          {panels.length === 0 ? (
            <div className="no-panels">
              <p>No Grafana panels added yet</p>
            </div>
          ) : (
            <div className="panels-grid" ref={panelsGridRef}>
              {computePanelLayout(panels, panelSizes, gridWidth).map((row, rowIdx) => (
                <div key={`row-${rowIdx}`} className="panels-row">
                  {row.map((item) => {
                    const idx = item.idx;
                    const panel = panels[idx];
                    const size = panelSizes[idx] || { width: 1000, height: 400 };
                    const isEditing = editingPanelIdx === idx;

                    return (
                      <div key={panel.id} className="panel-container">
                    {isEditing ? (
                      <div className="panel-edit-form">
                        <div className="edit-form-group">
                          <label>Panel Name</label>
                          <input
                            type="text"
                            value={editingPanelName}
                            onChange={(e) => setEditingPanelName(e.target.value)}
                            placeholder="e.g., CPU Usage, Memory"
                          />
                        </div>
                        <div className="edit-form-group">
                          <label>Panel URL</label>
                          <textarea
                            value={editingPanelUrl}
                            onChange={(e) => setEditingPanelUrl(e.target.value)}
                            placeholder="Paste iframe tag or URL"
                            rows="3"
                          />
                        </div>
                        <div className="edit-form-group">
                          <label>Panel Size</label>
                          <div className="size-controls-edit">
                            {(() => {
                              const { maxWidth, maxHeight } = getMaxDimensions();
                              return (
                                <>
                                  <label>
                                    Width:
                                    <input
                                      type="number"
                                      value={editingPanelWidth}
                                      onChange={(e) => {
                                        setEditingPanelWidth(e.target.value);
                                      }}
                                      onBlur={(e) => {
                                        const value = parseInt(e.target.value) || 200;
                                        const clampedValue = Math.min(Math.max(200, value), maxWidth);
                                        setEditingPanelWidth(clampedValue.toString());
                                        updatePanelSize(idx, 'width', clampedValue);
                                      }}
                                      min="200"
                                      max={maxWidth}
                                      step="50"
                                    />
                                    px (max: {maxWidth}px)
                                  </label>
                                  <label>
                                    Height:
                                    <input
                                      type="number"
                                      value={editingPanelHeight}
                                      onChange={(e) => {
                                        setEditingPanelHeight(e.target.value);
                                      }}
                                      onBlur={(e) => {
                                        const value = parseInt(e.target.value) || 200;
                                        const clampedValue = Math.min(Math.max(200, value), maxHeight);
                                        setEditingPanelHeight(clampedValue.toString());
                                        updatePanelSize(idx, 'height', clampedValue);
                                      }}
                                      min="200"
                                      max={maxHeight}
                                      step="50"
                                    />
                                    px (max: {maxHeight}px)
                                  </label>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="edit-form-actions">
                          <button
                            className="btn secondary"
                            onClick={cancelEditPanel}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn primary"
                            onClick={saveEditedPanel}
                          >
                            Save Panel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="panel-header">
                          <div className="panel-header-top">
                            <h3>{panel.name}</h3>
                            <div className="panel-header-buttons">
                              <button
                                className="edit-panel-btn"
                                onClick={() => startEditPanel(idx)}
                                title="Edit panel"
                              >
                                ✎
                              </button>
                              {panels.length > 1 && (
                                <button
                                  className="remove-panel-btn"
                                  onClick={() => handleRemovePanel(idx)}
                                  title="Remove this panel"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        {panel.url ? (
                          <div
                            className="iframe-container"
                            style={{
                              width: `${size.width}px`,
                              height: `${size.height}px`,
                              maxWidth: '100%',
                            }}
                          >
                            <GrafanaPanelIframe
                              title={`panel-${idx}`}
                              src={panel.url}
                              staggerIndex={idx}
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <div className="panel-placeholder">Invalid URL</div>
                        )}
                      </>
                    )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
