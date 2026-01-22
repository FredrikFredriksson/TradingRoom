import { useState } from 'react';
import { supabase } from '../lib/supabase';
import './Auth.css';

const Auth = ({ onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [googleEnabled, setGoogleEnabled] = useState(true);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      onAuthSuccess(data.session);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      
      if (error) {
        // If Google is not enabled, just hide the button instead of showing error
        if (error.message?.includes('provider is not enabled') || 
            error.message?.includes('Unsupported provider')) {
          setGoogleEnabled(false);
          setLoading(false);
          return;
        }
        throw error;
      }
      
      // If successful, the user will be redirected to Google
      // The loading state will be handled by the redirect
    } catch (err) {
      // Only show error if it's not about provider not being enabled
      if (!err.message?.includes('provider is not enabled') && 
          !err.message?.includes('Unsupported provider')) {
        setError(err.message || 'Failed to sign in with Google');
      } else {
        setGoogleEnabled(false);
      }
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-card">
        <div className="auth-header">
          <h1>TradingRoom</h1>
          <p>Sign in to access your trading journal</p>
          {!googleEnabled && (
            <p className="auth-subtitle">Using email/password authentication</p>
          )}
        </div>

        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}

        <div className="auth-options">
          {googleEnabled && (
            <>
              <button
                className="auth-button google-button"
                onClick={handleGoogleAuth}
                disabled={loading}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M17.64 9.20454C17.64 8.56636 17.5827 7.95272 17.4764 7.36363H9V10.845H13.8436C13.635 11.97 13.0009 12.9231 12.0477 13.5613V15.8195H14.9564C16.6582 14.2527 17.64 11.9454 17.64 9.20454Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9 18C11.43 18 13.467 17.1941 14.9564 15.8195L12.0477 13.5613C11.2418 14.1013 10.2109 14.4204 9 14.4204C6.65455 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9831 5.48182 18 9 18Z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40681 3.78409 7.83 3.96409 7.29V4.95818H0.957273C0.347727 6.17318 0 7.54772 0 9C0 10.4523 0.347727 11.8268 0.957273 13.0418L3.96409 10.71Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65455 3.57955 9 3.57955Z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="auth-divider">
                <span>or</span>
              </div>
            </>
          )}

          <form onSubmit={handleEmailAuth} className="auth-form">
            <div className="auth-input-group">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="auth-input"
              />
            </div>

            <div className="auth-input-group">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="auth-input"
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="auth-button primary-button"
            >
              {loading ? 'Loading...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;
