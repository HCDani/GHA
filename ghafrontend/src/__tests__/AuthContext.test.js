import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

// Mock pbClient - use factory so mocks are created at hoist time
jest.mock('../pbClient', () => {
  const mockAuthStore = {
    isValid: false,
    record: null,
    clear: jest.fn(),
  };
  const mockListAuthMethods = jest.fn();
  const mockAuthWithOAuth2Code = jest.fn();
  return {
    pb: {
      authStore: mockAuthStore,
      collection: () => ({
        listAuthMethods: mockListAuthMethods,
        authWithOAuth2Code: mockAuthWithOAuth2Code,
      }),
    },
    __getMockAuthStore: () => mockAuthStore,
    __getMockListAuthMethods: () => mockListAuthMethods,
  };
});

function TestConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="authenticated">{String(auth.isAuthenticated)}</span>
      <span data-testid="user-id">{auth.user?.id ?? 'null'}</span>
      <span data-testid="error">{auth.error ?? 'null'}</span>
      <button onClick={auth.loginWithKeycloak}>Login</button>
      <button onClick={auth.logout}>Logout</button>
    </div>
  );
}

import { __getMockAuthStore, __getMockListAuthMethods } from '../pbClient';

describe('AuthContext', () => {
  const originalLocation = window.location;
  const originalLocalStorage = window.localStorage;
  let mockAuthStore;
  let mockListAuthMethods;

  let setItemMock;
  let removeItemMock;

  beforeEach(() => {
    mockAuthStore = __getMockAuthStore();
    mockListAuthMethods = __getMockListAuthMethods();
    mockAuthStore.clear.mockClear();
    mockListAuthMethods.mockClear();
    delete window.location;
    window.location = {
      ...originalLocation,
      origin: 'https://test.example.com',
      href: '',
      search: '',
      replace: jest.fn(),
    };
    const storage = {};
    setItemMock = jest.fn((key, value) => { storage[key] = value; });
    removeItemMock = jest.fn((key) => { delete storage[key]; });
    window.localStorage = {
      getItem: jest.fn((key) => storage[key] ?? null),
      setItem: setItemMock,
      removeItem: removeItemMock,
      clear: jest.fn(),
    };
  });

  afterEach(() => {
    window.location = originalLocation;
    window.localStorage = originalLocalStorage;
  });

  describe('AuthProvider', () => {
    test('sets user from authStore when valid on mount', async () => {
      mockAuthStore.isValid = true;
      mockAuthStore.record = { id: 'user1', email: 'u@test.com' };

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('user-id')).toHaveTextContent('user1');
    });

    test('sets user null when authStore invalid on mount', async () => {
      mockAuthStore.isValid = false;
      mockAuthStore.record = null;

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('user-id')).toHaveTextContent('null');
    });
  });

  describe('loginWithKeycloak', () => {
    beforeEach(() => {
      mockAuthStore.isValid = false;
      mockAuthStore.record = null;
    });

    test('sets provider in localStorage and redirects to auth URL', async () => {
      mockListAuthMethods.mockResolvedValue({
        oauth2: {
          providers: [
            {
              name: 'oidc',
              authURL: 'https://keycloak.example.com/auth',
              authUrl: 'https://keycloak.example.com/auth',
            },
          ],
        },
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

      screen.getByText('Login').click();

      await waitFor(() => {
        expect(mockListAuthMethods).toHaveBeenCalled();
      });
      expect(window.location.href).toContain('https://keycloak.example.com/auth');
      expect(window.location.href).toContain('redirect_uri=https%3A%2F%2Ftest.example.com%2Fcallback');
    });

    test('sets error when Keycloak provider not found', async () => {
      mockListAuthMethods.mockResolvedValue({
        oauth2: { providers: [] },
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

      await act(async () => {
        screen.getByText('Login').click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('error')).not.toHaveTextContent('null');
      });
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
  });

  describe('logout', () => {
    test('clears authStore, localStorage, and redirects to grafana logout', async () => {
      mockAuthStore.isValid = true;
      mockAuthStore.record = { id: 'u1' };

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await waitFor(() => expect(screen.getByTestId('authenticated')).toHaveTextContent('true'));

      await act(async () => {
        screen.getByText('Logout').click();
      });

      expect(mockAuthStore.clear).toHaveBeenCalled();
      expect(window.location.replace).toHaveBeenCalledWith('https://test.example.com/grafana/logout');
    });
  });

  describe('handleOAuthCallback', () => {
    beforeEach(() => {
      mockAuthStore.isValid = false;
      mockAuthStore.record = null;
    });

    test('returns false when no code in URL', async () => {
      window.location.search = '';
      let callbackResult;
      function CallbackConsumer() {
        const { handleOAuthCallback } = useAuth();
        React.useEffect(() => {
          handleOAuthCallback().then((r) => { callbackResult = r; });
        }, [handleOAuthCallback]);
        return null;
      }
      render(
        <AuthProvider>
          <CallbackConsumer />
        </AuthProvider>
      );
      await waitFor(() => expect(callbackResult).toBe(false));
    });
  });

  describe('useAuth', () => {
    test('throws when used outside AuthProvider', () => {
      expect(() => {
        render(
          <div>
            <TestConsumer />
          </div>
        );
      }).toThrow('useAuth must be used within an AuthProvider');
    });
  });
});
