import React, { useState, useEffect } from 'react';
import { X, Cloud, Check, AlertCircle, Trash2, FolderOpen } from 'lucide-react';
import './DropboxSettings.css';

interface DropboxSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

// Dropbox App Key - this should be configured in environment or settings
const DROPBOX_APP_KEY = 'your_dropbox_app_key'; // User will need to set this

export const DropboxSettings: React.FC<DropboxSettingsProps> = ({ isOpen, onClose }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState('/Sturgis Projects');
  const [appKey, setAppKey] = useState(DROPBOX_APP_KEY);
  const [isConnecting, setIsConnecting] = useState(false);
  const [accountInfo, setAccountInfo] = useState<{ name: string; email: string } | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('dropbox_access_token');
    const savedFolder = localStorage.getItem('dropbox_folder_path');
    const savedAppKey = localStorage.getItem('dropbox_app_key');

    if (savedToken) setAccessToken(savedToken);
    if (savedFolder) setFolderPath(savedFolder);
    if (savedAppKey) setAppKey(savedAppKey);
  }, []);

  // Fetch account info when token is available
  useEffect(() => {
    if (accessToken) {
      fetchAccountInfo();
    }
  }, [accessToken]);

  const fetchAccountInfo = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAccountInfo({
          name: data.name.display_name,
          email: data.email,
        });
      } else {
        // Token might be invalid
        handleDisconnect();
      }
    } catch (error) {
      console.error('Error fetching Dropbox account info:', error);
    }
  };

  const handleConnect = () => {
    if (!appKey || appKey === 'your_dropbox_app_key') {
      alert('Please enter your Dropbox App Key first. You can get one from https://www.dropbox.com/developers/apps');
      return;
    }

    setIsConnecting(true);

    // Save app key
    localStorage.setItem('dropbox_app_key', appKey);

    // Generate random state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('dropbox_auth_state', state);

    // Redirect to Dropbox OAuth
    const redirectUri = `${window.location.origin}/dropbox-callback`;
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    // Open in popup
    const popup = window.open(authUrl, 'Dropbox Auth', 'width=600,height=700');

    // Listen for callback
    const checkPopup = setInterval(() => {
      try {
        if (popup?.closed) {
          clearInterval(checkPopup);
          setIsConnecting(false);
          // Check if token was saved
          const token = localStorage.getItem('dropbox_access_token');
          if (token) {
            setAccessToken(token);
          }
        }

        // Check if we can access popup location (same origin)
        if (popup?.location?.href?.includes('access_token')) {
          const hash = popup.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          const token = params.get('access_token');

          if (token) {
            localStorage.setItem('dropbox_access_token', token);
            setAccessToken(token);
            popup.close();
          }

          clearInterval(checkPopup);
          setIsConnecting(false);
        }
      } catch (e) {
        // Cross-origin error - popup is on Dropbox domain, ignore
      }
    }, 500);
  };

  const handleDisconnect = () => {
    localStorage.removeItem('dropbox_access_token');
    setAccessToken(null);
    setAccountInfo(null);
  };

  const handleSaveSettings = () => {
    localStorage.setItem('dropbox_folder_path', folderPath);
    localStorage.setItem('dropbox_app_key', appKey);
    alert('Dropbox settings saved!');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="dropbox-settings-overlay" onClick={onClose}>
      <div className="dropbox-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dropbox-settings-header">
          <div className="dropbox-settings-title">
            <Cloud size={24} />
            <span>Dropbox Settings</span>
          </div>
          <button className="dropbox-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="dropbox-settings-content">
          {/* Connection Status */}
          <div className="dropbox-section">
            <h3>Connection Status</h3>
            {accessToken && accountInfo ? (
              <div className="dropbox-connected">
                <div className="dropbox-account-info">
                  <Check size={20} className="success-icon" />
                  <div>
                    <p className="account-name">{accountInfo.name}</p>
                    <p className="account-email">{accountInfo.email}</p>
                  </div>
                </div>
                <button className="dropbox-disconnect-btn" onClick={handleDisconnect}>
                  <Trash2 size={16} />
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="dropbox-disconnected">
                <AlertCircle size={20} className="warning-icon" />
                <span>Not connected to Dropbox</span>
              </div>
            )}
          </div>

          {/* App Key */}
          <div className="dropbox-section">
            <h3>Dropbox App Key</h3>
            <p className="section-description">
              Create an app at{' '}
              <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer">
                Dropbox Developer Console
              </a>{' '}
              and paste your App Key here.
            </p>
            <input
              type="text"
              value={appKey}
              onChange={(e) => setAppKey(e.target.value)}
              placeholder="Enter your Dropbox App Key"
              className="dropbox-input"
            />
          </div>

          {/* Folder Path */}
          <div className="dropbox-section">
            <h3>Save Location</h3>
            <p className="section-description">
              Folder path in Dropbox where files will be saved.
            </p>
            <div className="dropbox-folder-input">
              <FolderOpen size={18} />
              <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="/Sturgis Projects"
                className="dropbox-input"
              />
            </div>
          </div>

          {/* Connect Button */}
          {!accessToken && (
            <button
              className="dropbox-connect-btn"
              onClick={handleConnect}
              disabled={isConnecting}
            >
              <Cloud size={20} />
              {isConnecting ? 'Connecting...' : 'Connect to Dropbox'}
            </button>
          )}
        </div>

        <div className="dropbox-settings-footer">
          <button className="dropbox-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="dropbox-save-btn" onClick={handleSaveSettings}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

// Utility function to upload file to Dropbox
export const uploadToDropbox = async (
  fileName: string,
  fileContent: Blob | string,
  contentType: string
): Promise<{ success: boolean; error?: string }> => {
  const accessToken = localStorage.getItem('dropbox_access_token');
  const folderPath = localStorage.getItem('dropbox_folder_path') || '/Sturgis Projects';

  if (!accessToken) {
    return { success: false, error: 'Not connected to Dropbox. Please configure in Settings.' };
  }

  try {
    const filePath = `${folderPath}/${fileName}`;

    // Convert string to blob if needed
    const blob = typeof fileContent === 'string'
      ? new Blob([fileContent], { type: contentType })
      : fileContent;

    const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: filePath,
          mode: 'overwrite',
          autorename: false,
          mute: false,
        }),
        'Content-Type': 'application/octet-stream',
      },
      body: blob,
    });

    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.json();
      return { success: false, error: error.error_summary || 'Upload failed' };
    }
  } catch (error) {
    console.error('Dropbox upload error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Check if Dropbox is connected
export const isDropboxConnected = (): boolean => {
  return !!localStorage.getItem('dropbox_access_token');
};
