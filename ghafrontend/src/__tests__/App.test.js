import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock pbClient so we never load the real pocketbase ESM package
jest.mock('../pbClient', () => {
  const greenhouseList = [
    {
      id: 'abc123',
      title: 'Greenhouse',
      description: 'Alma',
      order: 0,
      grafanadata: [
        { grafanaURL: 'https://gha.hock.hu/grafana/d-solo/adscqhd/panel?panelId=1', panel_width: 1000, panel_height: 400 },
      ],
    },
  ];
  return {
    pb: {
      collection: () => ({
        getFullList: () => Promise.resolve(greenhouseList),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
      authStore: { isValid: true, record: { id: 'user123', email: 'test@example.com', preferences: {} } },
    },
  };
});

jest.mock('../hooks/useWeather', () => ({
  useWeather: () => ({ temperature: null, humidity: null, lightLux: null, loading: false, error: null }),
}));

import App from '../App';
import { AuthProvider } from '../contexts/AuthContext';

describe('App integration', () => {
  test('renders greenhouse from PocketBase', async () => {
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('Greenhouse')).toBeInTheDocument(), { timeout: 3000 });

    const iframe = screen.getByTitle(/grafana-abc123/i);
    expect(iframe).toHaveAttribute('src', expect.stringContaining('grafana/d-solo'));
  });
});
