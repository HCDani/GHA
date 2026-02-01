import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function CallbackPage() {
  const navigate = useNavigate();
  const { handleOAuthCallback, loading } = useAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    async function processCallback() {
      const success = await handleOAuthCallback();
      if (success) {
        navigate('/');
      } else {
        navigate('/');
      }
    }

    processCallback();
  }, [handleOAuthCallback, navigate]);

  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <h1>Authenticating...</h1>
        <p>Please wait while we complete your login.</p>
      </div>
    </main>
  );
}
