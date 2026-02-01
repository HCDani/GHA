import { extractGrafanaUrl, normalizeGrafanaUrl } from '../utils/grafanaUrl';

describe('grafanaUrl', () => {
  describe('extractGrafanaUrl', () => {
    test('returns empty string for null or undefined', () => {
      expect(extractGrafanaUrl(null)).toBe('');
      expect(extractGrafanaUrl(undefined)).toBe('');
    });

    test('returns empty string for non-string', () => {
      expect(extractGrafanaUrl(123)).toBe('');
    });

    test('extracts URL from iframe src with double quotes', () => {
      const input = '<iframe src="https://grafana.example.com/d-solo/abc?panelId=1"></iframe>';
      expect(extractGrafanaUrl(input)).toBe('https://grafana.example.com/d-solo/abc?panelId=1');
    });

    test('extracts URL from iframe src with single quotes', () => {
      const input = "<iframe src='https://grafana.example.com/panel'></iframe>";
      expect(extractGrafanaUrl(input)).toBe('https://grafana.example.com/panel');
    });

    test('handles src= with spaces around equals', () => {
      const input = '<iframe src = "https://example.com/panel" />';
      expect(extractGrafanaUrl(input)).toBe('https://example.com/panel');
    });

    test('returns trimmed plain URL as-is', () => {
      const url = 'https://grafana.example.com/d-solo/xyz';
      expect(extractGrafanaUrl(url)).toBe(url);
      expect(extractGrafanaUrl('  ' + url + '  ')).toBe(url);
    });

    test('returns full string when no src= match', () => {
      expect(extractGrafanaUrl('not an iframe')).toBe('not an iframe');
    });
  });

  describe('normalizeGrafanaUrl', () => {
    test('returns null for empty or invalid after extract', () => {
      expect(normalizeGrafanaUrl('')).toBe(null);
      expect(normalizeGrafanaUrl(null)).toBe(null);
    });

    test('normalizes plain URL', () => {
      const url = 'https://grafana.example.com/d-solo/abc?panelId=1';
      expect(normalizeGrafanaUrl(url)).toBe(url);
    });

    test('extracts and normalizes from iframe', () => {
      const input = '<iframe src="https://grafana.example.com/panel"></iframe>';
      expect(normalizeGrafanaUrl(input)).toBe('https://grafana.example.com/panel');
    });

    test('adds https: for protocol-relative URL', () => {
      const input = '//grafana.example.com/panel';
      expect(normalizeGrafanaUrl(input)).toBe('https://grafana.example.com/panel');
    });

    test('addTimeRange adds from and to params', () => {
      const url = 'https://grafana.example.com/d-solo/abc';
      const result = normalizeGrafanaUrl(url, { addTimeRange: true });
      expect(result).toContain('https://grafana.example.com/d-solo/abc');
      expect(result).toContain('from=now-24h');
      expect(result).toContain('to=now');
    });

    test('addTimeRange false does not add time params', () => {
      const url = 'https://grafana.example.com/panel';
      expect(normalizeGrafanaUrl(url, { addTimeRange: false })).toBe(url);
      expect(normalizeGrafanaUrl(url)).toBe(url);
    });

    test('returns null for invalid URL after extract', () => {
      expect(normalizeGrafanaUrl('not-a-valid-url')).toBe(null);
    });
  });
});
