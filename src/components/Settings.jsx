import { useState, useEffect } from 'react';
import { blofinClient } from '../lib/blofin';
import './Settings.css';

const Settings = ({ isOpen, onClose, onBlofinConfigured }) => {
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [status, setStatus] = useState('checking'); // checking, not_configured, configured, error
  const [message, setMessage] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  const checkStatus = async () => {
    setStatus('checking');
    try {
      const result = await blofinClient.checkStatus();
      if (result.configured) {
        setStatus('configured');
        setMessage('Blofin API is connected');
      } else {
        setStatus('not_configured');
        setMessage('Enter your Blofin API credentials');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Cannot connect to backend server. Make sure it\'s running on port 3001.');
    }
  };

  const handleTest = async () => {
    if (!apiKey || !secretKey || !passphrase) {
      setMessage('Please fill in all fields');
      return;
    }

    setTesting(true);
    setMessage('Testing connection...');

    try {
      // First save the credentials
      await blofinClient.configure(apiKey, secretKey, passphrase);
      
      // Then test the connection
      const result = await blofinClient.testConnection();
      
      if (result.success) {
        setStatus('configured');
        setMessage('✅ Connection successful! API is working.');
        onBlofinConfigured?.(true);
      } else {
        setMessage('❌ Connection failed: ' + (result.data?.msg || 'Unknown error'));
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey || !secretKey || !passphrase) {
      setMessage('Please fill in all fields');
      return;
    }

    setSaving(true);
    try {
      await blofinClient.configure(apiKey, secretKey, passphrase);
      setStatus('configured');
      setMessage('✅ Credentials saved successfully!');
      onBlofinConfigured?.(true);
      
      // Clear the form for security
      setApiKey('');
      setSecretKey('');
      setPassphrase('');
    } catch (error) {
      setMessage('❌ Error saving credentials: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Settings</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
          {/* Blofin Connection Section */}
          <section className="settings-section">
            <h3>🔗 Blofin Exchange Connection</h3>
            
            <div className={`connection-status ${status}`}>
              {status === 'checking' && <span>🔄 Checking connection...</span>}
              {status === 'configured' && <span>✅ Connected to Blofin</span>}
              {status === 'not_configured' && <span>⚠️ Not configured</span>}
              {status === 'error' && <span>❌ Backend server not running</span>}
            </div>

            {status === 'error' && (
              <div className="error-help">
                <p>To connect to Blofin, you need to start the backend server:</p>
                <code>
                  cd server<br/>
                  npm install<br/>
                  npm run dev
                </code>
              </div>
            )}

            {(status === 'not_configured' || status === 'configured') && (
              <>
                <div className="form-group">
                  <label>API Key</label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Blofin API Key"
                  />
                </div>

                <div className="form-group">
                  <label>Secret Key</label>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="Enter your Secret Key"
                  />
                </div>

                <div className="form-group">
                  <label>Passphrase</label>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Enter your Passphrase"
                  />
                </div>

                {message && (
                  <div className={`message ${message.includes('✅') ? 'success' : message.includes('❌') ? 'error' : ''}`}>
                    {message}
                  </div>
                )}

                <div className="button-row">
                  <button 
                    className="btn-test"
                    onClick={handleTest}
                    disabled={testing || !apiKey || !secretKey || !passphrase}
                  >
                    {testing ? '🔄 Testing...' : '🧪 Test Connection'}
                  </button>
                  <button 
                    className="btn-save"
                    onClick={handleSave}
                    disabled={saving || !apiKey || !secretKey || !passphrase}
                  >
                    {saving ? '💾 Saving...' : '💾 Save Credentials'}
                  </button>
                </div>

                <div className="security-note">
                  <span className="lock-icon">🔒</span>
                  <p>Your credentials are stored securely on the local backend server and never sent to any external service.</p>
                </div>
              </>
            )}
          </section>

          {/* Instructions */}
          <section className="settings-section">
            <h3>📖 How to get Blofin API Keys</h3>
            <ol className="instructions">
              <li>Log in to <a href="https://blofin.com" target="_blank" rel="noopener noreferrer">Blofin</a></li>
              <li>Go to <strong>API Management</strong> in your account settings</li>
              <li>Click <strong>Create API Key</strong></li>
              <li>Select any application name (e.g., "TokenBot")</li>
              <li>Enable permissions: <strong>Read</strong> and <strong>Trade</strong></li>
              <li>Set a <strong>Passphrase</strong> you'll remember</li>
              <li>Copy the <strong>API Key</strong>, <strong>Secret Key</strong>, and <strong>Passphrase</strong></li>
              <li className="warning">⚠️ The Secret Key is only shown once! Save it immediately.</li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
