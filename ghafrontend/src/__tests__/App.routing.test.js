import React from 'react';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, Navigate } from 'react-router-dom';
import '@testing-library/jest-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import CallbackPage from '../pages/CallbackPage';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user1', email: 'test@example.com', preferences: {} },
    loading: false,
    isAuthenticated: true,
    loginWithKeycloak: jest.fn(),
    handleOAuthCallback: jest.fn().mockResolvedValue(true),
  }),
}));

const GreenhouseListMarker = () => <div data-testid="greenhouse-list">GreenhouseList</div>;
const GreenhouseDetailPageMarker = () => <div data-testid="greenhouse-detail">GreenhouseDetailPage</div>;

const routes = [
  { path: '/callback', element: <CallbackPage /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <GreenhouseListMarker />
      </ProtectedRoute>
    ),
  },
  {
    path: '/greenhouse/:id',
    element: (
      <ProtectedRoute>
        <GreenhouseDetailPageMarker />
      </ProtectedRoute>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
];

describe('App routing', () => {
  test('renders CallbackPage at /callback', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/callback'] });
    render(<RouterProvider router={router} />);
    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
  });

  test('renders GreenhouseList at /', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);
    expect(screen.getByTestId('greenhouse-list')).toBeInTheDocument();
  });

  test('renders GreenhouseDetailPage at /greenhouse/:id', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/greenhouse/abc123'] });
    render(<RouterProvider router={router} />);
    expect(screen.getByTestId('greenhouse-detail')).toBeInTheDocument();
  });

  test('redirects unknown path to /', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/unknown-path'] });
    render(<RouterProvider router={router} />);
    expect(screen.getByTestId('greenhouse-list')).toBeInTheDocument();
  });
});
