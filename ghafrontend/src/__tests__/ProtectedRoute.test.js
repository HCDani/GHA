import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProtectedRoute from '../components/ProtectedRoute';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '../contexts/AuthContext';

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuth.mockReset();
  });

  test('shows Loading when loading is true', () => {
    useAuth.mockReturnValue({
      loading: true,
      isAuthenticated: false,
      loginWithKeycloak: jest.fn(),
    });

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  test('shows Redirecting to Keycloak and calls loginWithKeycloak when not authenticated', () => {
    const loginWithKeycloak = jest.fn();
    useAuth.mockReturnValue({
      loading: false,
      isAuthenticated: false,
      loginWithKeycloak,
    });

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Redirecting to Keycloak...')).toBeInTheDocument();
    expect(loginWithKeycloak).toHaveBeenCalled();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  test('renders children when authenticated', () => {
    useAuth.mockReturnValue({
      loading: false,
      isAuthenticated: true,
      loginWithKeycloak: jest.fn(),
    });

    render(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(screen.queryByText('Redirecting to Keycloak...')).not.toBeInTheDocument();
  });
});
