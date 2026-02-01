import React, { createContext, useState, useEffect, useCallback } from 'react';
import { pb } from '../pbClient';

export const AuthContext = createContext(null);

const PB_OAUTH_PROVIDER_STORAGE_KEY = 'pb_oauth_provider';
// PocketBase default auth storage key (LocalAuthStore); clear explicitly so logout is fully persisted
const PB_AUTH_STORAGE_KEY = 'pocketbase_auth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    setLoading(true);
    setError(null);
    try {
      // PocketBase stores auth info in localStorage
      if (pb.authStore.isValid) {
        setUser(pb.authStore.record);
      }
    } catch (err) {
      console.error('Failed to restore auth state:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithKeycloak = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const authMethods = await pb.collection('users').listAuthMethods();
      const keycloakProvider = authMethods.oauth2.providers?.find(
        (p) => p.name.toLowerCase() === 'oidc'
      );

      if (!keycloakProvider) {
        throw new Error('Keycloak provider not configured in PocketBase');
      }

      const redirectUri = `${window.location.origin}/callback`;
      localStorage.setItem(PB_OAUTH_PROVIDER_STORAGE_KEY, JSON.stringify(keycloakProvider));
      const authUrlStr = keycloakProvider.authURL || keycloakProvider.authUrl;
      const authUrl = new URL(authUrlStr);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      window.location.href = authUrl.toString();
    } catch (err) {
      console.error('Failed to initiate Keycloak login:', err);
      setError(err.message);
      setLoading(false);
    }
  }, []);

  const handleOAuthCallback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Exchange OAuth code for session
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');

      if (code && state) {
        const redirectUri = `${window.location.origin}/callback`;

        let provider = null;
        try {
          provider = JSON.parse(localStorage.getItem(PB_OAUTH_PROVIDER_STORAGE_KEY) || 'null');
        } catch {
          provider = null;
        }

        if (!provider) {
          throw new Error(
            'Missing OAuth provider context. Please start the login flow again from the Login with Keycloak button.'
          );
        }

        // CSRF protection: ensure the "state" we got back matches the one PocketBase generated.
        if (provider.state !== state) {
          throw new Error('OAuth state mismatch. Please try logging in again.');
        }
        
        // PocketBase SDK handles the code exchange
        // The SDK will authenticate and redirect back
        try {
          const record = await pb.collection('users').authWithOAuth2Code(
            provider.name,
            code,
            provider.codeVerifier,
            redirectUri
          );

          if (record) {
            setUser(record.record);
            localStorage.removeItem(PB_OAUTH_PROVIDER_STORAGE_KEY);
            return true;
          }
        } catch (err) {
          // Handle the case where the code was already used (React.StrictMode double-invocation)
          if (err.status === 400 && pb.authStore.isValid) {
            // Already authenticated, likely from the first attempt
            setUser(pb.authStore.record);
            localStorage.removeItem(PB_OAUTH_PROVIDER_STORAGE_KEY);
            return true;
          }
          throw err;
        }
      }
    } catch (err) {
      console.error('OAuth callback failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
    return false;
  }, []);

  const logout = useCallback(async () => {
    try {
      // Clear auth store and localStorage so when Keycloak redirects back we're logged out
      pb.authStore.clear();
      try {
        localStorage.removeItem(PB_OAUTH_PROVIDER_STORAGE_KEY);
        localStorage.removeItem(PB_AUTH_STORAGE_KEY);
      } catch (e) {
        // ignore if localStorage is unavailable (e.g. private mode)
      }

      window.location.replace(`${window.location.origin}/grafana/logout`);
    } catch (err) {
      console.error('Logout failed:', err);
      setError(err.message);
    }
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    loginWithKeycloak,
    handleOAuthCallback,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
