/**
 * Extracts the URL from a string that may be an iframe tag (e.g. src="...") or already a URL.
 * @param {string} str - Input: iframe snippet or plain URL
 * @returns {string} - The URL (extracted from src= or the string as-is)
 */
export function extractGrafanaUrl(str) {
  if (!str || typeof str !== 'string') return '';
  const s = str.trim();
  const m = s.match(/src\s*=\s*['\"]([^'\"]+)['\"]/i);
  return (m && m[1]) ? m[1].trim() : s;
}

/**
 * Normalizes a Grafana panel URL: extracts from iframe if needed, optionally adds time range.
 * @param {string} str - Input: iframe snippet or URL
 * @param {{ addTimeRange?: boolean }} options - If addTimeRange is true, adds from=now-24h and to=now
 * @returns {string | null} - Normalized URL or null if invalid
 */
export function normalizeGrafanaUrl(str, { addTimeRange = false } = {}) {
  let url = extractGrafanaUrl(str);
  if (!url) return null;
  if (url.startsWith('//')) url = 'https:' + url;
  try {
    const u = new URL(url);
    if (addTimeRange) {
      u.searchParams.set('from', 'now-24h');
      u.searchParams.set('to', 'now');
    }
    return u.toString();
  } catch {
    return null;
  }
}
