import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, loginWithKeycloak } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      loginWithKeycloak();
    }
  }, [loading, isAuthenticated, loginWithKeycloak]);

  if (loading) {
    return (
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Loading...</h1>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Redirecting to Keycloak...</h1>
        </div>
      </main>
    );
  }

  return children;
}
