import React, { useState, useEffect } from 'react';

/** Delay (ms) before loading non-first Grafana iframes. First iframe loads immediately; the rest load together after this delay to avoid OAuth "state does not match". */
export const GRAFANA_IFRAME_STAGGER_MS = 1000;

/**
 * Renders a Grafana panel iframe with staggered loading. The first panel (staggerIndex 0)
 * loads immediately; all others load together after one short delay so only the first
 * OAuth flow runs, then the rest reuse the session.
 *
 * @param {string} src - iframe src URL
 * @param {number} staggerIndex - 0-based index (0 = load immediately; 1+ = load after delay)
 * @param {number} [staggerMs] - delay before loading 2nd, 3rd, ... panels (default GRAFANA_IFRAME_STAGGER_MS)
 * @param {object} [rest] - other iframe props (title, style, etc.)
 */
function GrafanaPanelIframe({ src, staggerIndex = 0, staggerMs = GRAFANA_IFRAME_STAGGER_MS, ...rest }) {
  const [effectiveSrc, setEffectiveSrc] = useState(() =>
    staggerIndex === 0 ? src : ''
  );

  useEffect(() => {
    if (!src) {
      setEffectiveSrc('');
      return;
    }
    if (staggerIndex === 0) {
      setEffectiveSrc(src);
      return;
    }
    const delay = staggerMs;
    const t = setTimeout(() => setEffectiveSrc(src), delay);
    return () => clearTimeout(t);
  }, [src, staggerIndex, staggerMs]);

  if (!effectiveSrc) {
    return (
      <div className="grafana-panel-placeholder" aria-hidden="true">
        <span>Loading panel…</span>
      </div>
    );
  }

  return <iframe src={effectiveSrc} frameBorder="0" {...rest} />;
}

export default GrafanaPanelIframe;
