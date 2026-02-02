import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

jest.mock('../contexts/AuthContext', () => {
  const React = require('react');
  const actual = jest.requireActual('../contexts/AuthContext');
  const mockLogout = jest.fn();
  return {
    AuthContext: actual.AuthContext,
    useAuth: actual.useAuth,
    AuthProvider: ({ children }) => (
      <actual.AuthContext.Provider
        value={{
          user: {
            id: 'user123',
            email: 'test@example.com',
            preferences: { lat: 47.5, lon: 19.0, city: 'Budapest' },
          },
          logout: mockLogout,
          isAuthenticated: true,
          loading: false,
          error: null,
          loginWithKeycloak: jest.fn(),
        }}
      >
        {children}
      </actual.AuthContext.Provider>
    ),
    __getMockLogout: () => mockLogout,
  };
});

jest.mock('../hooks/useWeather', () => ({
  useWeather: () => ({
    temperature: 22,
    humidity: 65,
    lightLux: 11000,
    loading: false,
    error: null,
  }),
}));

jest.mock('../pbClient', () => {
  const mockGetFullList = jest.fn();
  return {
    pb: {
      collection: () => ({
        getFullList: mockGetFullList,
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      }),
      authStore: { isValid: true, record: { id: 'user123', preferences: {} } },
    },
    __getMockGetFullList: () => mockGetFullList,
  };
});

jest.mock('react-toastify', () => ({
  ToastContainer: () => null,
  toast: { success: jest.fn(), error: jest.fn() },
}));

import App from '../App';
import { AuthProvider, __getMockLogout } from '../contexts/AuthContext';
import { __getMockGetFullList } from '../pbClient';
import { toast } from 'react-toastify';

describe('App flows', () => {
  beforeEach(() => {
    __getMockLogout().mockClear();
    toast.error.mockClear();
    __getMockGetFullList().mockResolvedValue([]);
  });

  test('header shows weather when user has lat/lon and useWeather returns data', async () => {
    render(
      <AuthProvider>
        <App />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Local weather')).toBeInTheDocument();
    });
    expect(screen.getByText(/Weather data: Budapest/)).toBeInTheDocument();
    expect(screen.getByText(/Temp: 22°C/)).toBeInTheDocument();
    expect(screen.getByText(/Humidity: 65%/)).toBeInTheDocument();
    expect(screen.getByText(/Light: 11000 lux/)).toBeInTheDocument();
  });

  test('Logout button calls logout', async () => {
    render(<AuthProvider><App /></AuthProvider>);

    await waitFor(() => expect(screen.getByRole('button', { name: /Logout/i })).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /Logout/i }));

    expect(__getMockLogout()).toHaveBeenCalled();
  });

  test('list shows greenhouse card that is clickable', async () => {
    __getMockGetFullList().mockResolvedValue([
      {
        id: 'gh1',
        title: 'My Greenhouse',
        description: '',
        order: 0,
        grafanadata: [],
      },
    ]);

    render(<AuthProvider><App /></AuthProvider>);

    await waitFor(() => expect(screen.getByText('My Greenhouse')).toBeInTheDocument());

    const card = screen.getByText('My Greenhouse').closest('article');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('role', 'button');
  });

  test('getFullList error shows toast.error', async () => {
    __getMockGetFullList().mockRejectedValue(new Error('Network error'));

    render(<AuthProvider><App /></AuthProvider>);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load greenhouses');
    });
  });
});
