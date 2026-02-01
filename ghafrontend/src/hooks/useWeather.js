import { useState, useEffect } from 'react';

const OPEN_METEO_BASE = '/weather/v1/forecast';
/** Approximate lux per W/m² for daylight (shortwave radiation). */
const W_M2_TO_LUX = 110;

/**
 * Fetches current weather from Open-Meteo for the given coordinates.
 * Returns temperature (°C), relative humidity (%), and light (lux from shortwave radiation).
 * @param {number | null | undefined} lat - Latitude
 * @param {number | null | undefined} lon - Longitude
 * @returns {{ temperature: number | null, humidity: number | null, lightLux: number | null, loading: boolean, error: string | null }}
 */
export function useWeather(lat, lon) {
  const [temperature, setTemperature] = useState(null);
  const [humidity, setHumidity] = useState(null);
  const [lightLux, setLightLux] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const latitude = lat != null && lat !== '' ? Number(lat) : NaN;
    const longitude = lon != null && lon !== '' ? Number(lon) : NaN;
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setTemperature(null);
      setHumidity(null);
      setLightLux(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'temperature_2m,relative_humidity_2m,shortwave_radiation',
    });

    fetch(`${OPEN_METEO_BASE}?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Weather API: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const cur = data.current;
        if (!cur) {
          setTemperature(null);
          setHumidity(null);
          setLightLux(null);
          setError('No current data');
          return;
        }
        const temp = cur.temperature_2m;
        const hum = cur.relative_humidity_2m;
        const sw = cur.shortwave_radiation;
        setTemperature(typeof temp === 'number' ? temp : null);
        setHumidity(typeof hum === 'number' ? hum : null);
        // shortwave_radiation W/m² → lux (night can be null or 0)
        setLightLux(typeof sw === 'number' && sw >= 0 ? Math.round(sw * W_M2_TO_LUX) : null);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setTemperature(null);
          setHumidity(null);
          setLightLux(null);
          setError(err.message || 'Failed to load weather');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  return { temperature, humidity, lightLux, loading, error };
}
