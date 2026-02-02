import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';
import CallbackPage from '../pages/CallbackPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '../contexts/AuthContext';

describe('CallbackPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    useAuth.mockReset();
  });

  test('renders Authenticating message', () => {
    useAuth.mockReturnValue({
      handleOAuthCallback: jest.fn().mockResolvedValue(true),
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/callback']}>
        <Routes>
          <Route path="/callback" element={<CallbackPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
    expect(screen.getByText(/Please wait while we complete your login/i)).toBeInTheDocument();
  });

  test('calls handleOAuthCallback and navigates to / on success', async () => {
    const handleOAuthCallback = jest.fn().mockResolvedValue(true);
    useAuth.mockReturnValue({
      handleOAuthCallback,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/callback']}>
        <Routes>
          <Route path="/callback" element={<CallbackPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(handleOAuthCallback).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  test('calls handleOAuthCallback and navigates to / on failure', async () => {
    const handleOAuthCallback = jest.fn().mockResolvedValue(false);
    useAuth.mockReturnValue({
      handleOAuthCallback,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/callback']}>
        <Routes>
          <Route path="/callback" element={<CallbackPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(handleOAuthCallback).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
