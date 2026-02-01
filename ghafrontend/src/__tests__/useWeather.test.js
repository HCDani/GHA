import { renderHook, waitFor } from '@testing-library/react';
import { useWeather } from '../hooks/useWeather';

describe('useWeather', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('returns nulls and does not fetch when lat/lon are invalid', async () => {
    const { result } = renderHook(() => useWeather(null, null));

    expect(result.current.temperature).toBe(null);
    expect(result.current.humidity).toBe(null);
    expect(result.current.lightLux).toBe(null);
    expect(result.current.error).toBe(null);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('returns nulls when lat or lon is NaN', () => {
    const { result } = renderHook(() => useWeather('invalid', 0));
    expect(result.current.temperature).toBe(null);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('fetches and sets temperature, humidity, lightLux on success', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          current: {
            temperature_2m: 22.5,
            relative_humidity_2m: 65,
            shortwave_radiation: 500,
          },
        }),
    });

    const { result } = renderHook(() => useWeather(47.5, 19.0));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/weather/v1/forecast')
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\?.*latitude=47\.5.*longitude=19/)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.temperature).toBe(22.5);
    expect(result.current.humidity).toBe(65);
    // shortwave_radiation 500 * 110 ≈ 55000
    expect(result.current.lightLux).toBe(55000);
    expect(result.current.error).toBe(null);
  });

  test('sets error when fetch fails', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useWeather(47.5, 19.0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.temperature).toBe(null);
    expect(result.current.humidity).toBe(null);
    expect(result.current.lightLux).toBe(null);
    expect(result.current.error).toBeTruthy();
  });

  test('sets error when response is not ok', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { result } = renderHook(() => useWeather(47.5, 19.0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toContain('500');
  });

  test('handles missing current in response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useWeather(47.5, 19.0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.temperature).toBe(null);
    expect(result.current.humidity).toBe(null);
    expect(result.current.lightLux).toBe(null);
    expect(result.current.error).toBe('No current data');
  });

  test('converts shortwave_radiation to lux (W/m² * 110)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          current: {
            temperature_2m: 20,
            relative_humidity_2m: 50,
            shortwave_radiation: 100,
          },
        }),
    });

    const { result } = renderHook(() => useWeather(0, 0));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.lightLux).toBe(11000);
  });
});
