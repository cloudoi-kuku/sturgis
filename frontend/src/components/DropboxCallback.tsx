import React, { useEffect, useState } from 'react';
import { Cloud, Check, X } from 'lucide-react';

export const DropboxCallback: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    // Parse the access token from the URL hash
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Authentication failed: ${error}`);
      return;
    }

    // Verify state to prevent CSRF
    const savedState = localStorage.getItem('dropbox_auth_state');
    if (state !== savedState) {
      setStatus('error');
      setMessage('Authentication failed: Invalid state parameter');
      return;
    }

    if (accessToken) {
      // Save the token
      localStorage.setItem('dropbox_access_token', accessToken);
      localStorage.removeItem('dropbox_auth_state');

      setStatus('success');
      setMessage('Successfully connected to Dropbox!');

      // Close the window after a short delay
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      setStatus('error');
      setMessage('No access token received');
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '400px',
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          background: status === 'success'
            ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
            : status === 'error'
            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
            : 'linear-gradient(135deg, #0061fe 0%, #0052d4 100%)',
        }}>
          {status === 'processing' && <Cloud size={40} color="white" />}
          {status === 'success' && <Check size={40} color="white" />}
          {status === 'error' && <X size={40} color="white" />}
        </div>

        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: '600',
          color: '#1e293b',
          marginBottom: '0.75rem',
        }}>
          {status === 'processing' && 'Connecting to Dropbox'}
          {status === 'success' && 'Connected!'}
          {status === 'error' && 'Connection Failed'}
        </h1>

        <p style={{
          color: '#64748b',
          fontSize: '0.9375rem',
          lineHeight: '1.5',
        }}>
          {message}
        </p>

        {status === 'success' && (
          <p style={{
            color: '#94a3b8',
            fontSize: '0.8125rem',
            marginTop: '1rem',
          }}>
            This window will close automatically...
          </p>
        )}

        {status === 'error' && (
          <button
            onClick={() => window.close()}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              background: '#0061fe',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Close Window
          </button>
        )}
      </div>
    </div>
  );
};
