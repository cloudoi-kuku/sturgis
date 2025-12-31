import React, { useState, useEffect } from 'react';
import { X, Cloud, Check, AlertCircle, Trash2, FolderOpen, HardDrive } from 'lucide-react';
import './CloudStorageSettings.css';

interface CloudStorageSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

// Storage provider types
type StorageProvider = 'dropbox' | 'onedrive';

export const CloudStorageSettings: React.FC<CloudStorageSettingsProps> = ({ isOpen, onClose }) => {
  // Dropbox state
  const [dropboxToken, setDropboxToken] = useState<string | null>(null);
  const [dropboxFolder, setDropboxFolder] = useState('/Sturgis Projects');
  const [dropboxAppKey, setDropboxAppKey] = useState('');
  const [dropboxAccount, setDropboxAccount] = useState<{ name: string; email: string } | null>(null);

  // OneDrive state
  const [oneDriveToken, setOneDriveToken] = useState<string | null>(null);
  const [oneDriveFolder, setOneDriveFolder] = useState('/Sturgis Projects');
  const [oneDriveClientId, setOneDriveClientId] = useState('');
  const [oneDriveAccount, setOneDriveAccount] = useState<{ name: string; email: string } | null>(null);

  const [activeTab, setActiveTab] = useState<StorageProvider>('dropbox');
  const [isConnecting, setIsConnecting] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    // Dropbox
    const savedDropboxToken = localStorage.getItem('dropbox_access_token');
    const savedDropboxFolder = localStorage.getItem('dropbox_folder_path');
    const savedDropboxAppKey = localStorage.getItem('dropbox_app_key');
    if (savedDropboxToken) setDropboxToken(savedDropboxToken);
    if (savedDropboxFolder) setDropboxFolder(savedDropboxFolder);
    if (savedDropboxAppKey) setDropboxAppKey(savedDropboxAppKey);

    // OneDrive
    const savedOneDriveToken = localStorage.getItem('onedrive_access_token');
    const savedOneDriveFolder = localStorage.getItem('onedrive_folder_path');
    const savedOneDriveClientId = localStorage.getItem('onedrive_client_id');
    if (savedOneDriveToken) setOneDriveToken(savedOneDriveToken);
    if (savedOneDriveFolder) setOneDriveFolder(savedOneDriveFolder);
    if (savedOneDriveClientId) setOneDriveClientId(savedOneDriveClientId);
  }, []);

  // Fetch account info when tokens are available
  useEffect(() => {
    if (dropboxToken) fetchDropboxAccount();
  }, [dropboxToken]);

  useEffect(() => {
    if (oneDriveToken) fetchOneDriveAccount();
  }, [oneDriveToken]);

  const fetchDropboxAccount = async () => {
    if (!dropboxToken) return;
    try {
      const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${dropboxToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDropboxAccount({ name: data.name.display_name, email: data.email });
      } else {
        handleDisconnect('dropbox');
      }
    } catch (error) {
      console.error('Error fetching Dropbox account:', error);
    }
  };

  const fetchOneDriveAccount = async () => {
    if (!oneDriveToken) return;
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { 'Authorization': `Bearer ${oneDriveToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setOneDriveAccount({ name: data.displayName, email: data.userPrincipalName || data.mail });
      } else {
        handleDisconnect('onedrive');
      }
    } catch (error) {
      console.error('Error fetching OneDrive account:', error);
    }
  };

  const handleConnectDropbox = () => {
    if (!dropboxAppKey) {
      alert('Please enter your Dropbox App Key first.');
      return;
    }
    setIsConnecting(true);
    localStorage.setItem('dropbox_app_key', dropboxAppKey);

    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('dropbox_auth_state', state);

    const redirectUri = `${window.location.origin}/dropbox-callback`;
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${dropboxAppKey}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    const popup = window.open(authUrl, 'Dropbox Auth', 'width=600,height=700');

    const checkPopup = setInterval(() => {
      try {
        if (popup?.closed) {
          clearInterval(checkPopup);
          setIsConnecting(false);
          const token = localStorage.getItem('dropbox_access_token');
          if (token) setDropboxToken(token);
        }
        if (popup?.location?.href?.includes('access_token')) {
          const hash = popup.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          const token = params.get('access_token');
          if (token) {
            localStorage.setItem('dropbox_access_token', token);
            setDropboxToken(token);
            popup.close();
          }
          clearInterval(checkPopup);
          setIsConnecting(false);
        }
      } catch (e) { /* Cross-origin, ignore */ }
    }, 500);
  };

  const handleConnectOneDrive = () => {
    if (!oneDriveClientId) {
      alert('Please enter your Microsoft Application (Client) ID first.');
      return;
    }
    setIsConnecting(true);
    localStorage.setItem('onedrive_client_id', oneDriveClientId);

    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('onedrive_auth_state', state);

    const redirectUri = `${window.location.origin}/onedrive-callback`;
    const scope = 'files.readwrite user.read offline_access';
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${oneDriveClientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&response_mode=fragment`;

    const popup = window.open(authUrl, 'OneDrive Auth', 'width=600,height=700');

    const checkPopup = setInterval(() => {
      try {
        if (popup?.closed) {
          clearInterval(checkPopup);
          setIsConnecting(false);
          const token = localStorage.getItem('onedrive_access_token');
          if (token) setOneDriveToken(token);
        }
        if (popup?.location?.href?.includes('access_token')) {
          const hash = popup.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          const token = params.get('access_token');
          if (token) {
            localStorage.setItem('onedrive_access_token', token);
            setOneDriveToken(token);
            popup.close();
          }
          clearInterval(checkPopup);
          setIsConnecting(false);
        }
      } catch (e) { /* Cross-origin, ignore */ }
    }, 500);
  };

  const handleDisconnect = (provider: StorageProvider) => {
    if (provider === 'dropbox') {
      localStorage.removeItem('dropbox_access_token');
      setDropboxToken(null);
      setDropboxAccount(null);
    } else {
      localStorage.removeItem('onedrive_access_token');
      setOneDriveToken(null);
      setOneDriveAccount(null);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('dropbox_folder_path', dropboxFolder);
    localStorage.setItem('dropbox_app_key', dropboxAppKey);
    localStorage.setItem('onedrive_folder_path', oneDriveFolder);
    localStorage.setItem('onedrive_client_id', oneDriveClientId);
    alert('Cloud storage settings saved!');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="cloud-settings-overlay" onClick={onClose}>
      <div className="cloud-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cloud-settings-header">
          <div className="cloud-settings-title">
            <Cloud size={24} />
            <span>Cloud Storage Settings</span>
          </div>
          <button className="cloud-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="cloud-tabs">
          <button
            className={`cloud-tab ${activeTab === 'dropbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('dropbox')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M6 2L0 6l6 4-6 4 6 4 6-4-6-4 6-4-6-4zm12 0l-6 4 6 4-6 4 6 4 6-4-6-4 6-4-6-4zM6 14l6 4 6-4-6 4-6-4z"/>
            </svg>
            Dropbox
            {dropboxToken && <Check size={14} className="tab-connected" />}
          </button>
          <button
            className={`cloud-tab ${activeTab === 'onedrive' ? 'active' : ''}`}
            onClick={() => setActiveTab('onedrive')}
          >
            <HardDrive size={18} />
            OneDrive
            {oneDriveToken && <Check size={14} className="tab-connected" />}
          </button>
        </div>

        <div className="cloud-settings-content">
          {/* Dropbox Tab */}
          {activeTab === 'dropbox' && (
            <>
              <div className="cloud-section">
                <h3>Connection Status</h3>
                {dropboxToken && dropboxAccount ? (
                  <div className="cloud-connected">
                    <div className="cloud-account-info">
                      <Check size={20} className="success-icon" />
                      <div>
                        <p className="account-name">{dropboxAccount.name}</p>
                        <p className="account-email">{dropboxAccount.email}</p>
                      </div>
                    </div>
                    <button className="cloud-disconnect-btn" onClick={() => handleDisconnect('dropbox')}>
                      <Trash2 size={16} />
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="cloud-disconnected">
                    <AlertCircle size={20} className="warning-icon" />
                    <span>Not connected to Dropbox</span>
                  </div>
                )}
              </div>

              <div className="cloud-section">
                <h3>Dropbox App Key</h3>
                <p className="section-description">
                  Create an app at{' '}
                  <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer">
                    Dropbox Developer Console
                  </a>
                </p>
                <input
                  type="text"
                  value={dropboxAppKey}
                  onChange={(e) => setDropboxAppKey(e.target.value)}
                  placeholder="Enter your Dropbox App Key"
                  className="cloud-input"
                />
              </div>

              <div className="cloud-section">
                <h3>Save Location</h3>
                <div className="cloud-folder-input">
                  <FolderOpen size={18} />
                  <input
                    type="text"
                    value={dropboxFolder}
                    onChange={(e) => setDropboxFolder(e.target.value)}
                    placeholder="/Sturgis Projects"
                    className="cloud-input"
                  />
                </div>
              </div>

              {!dropboxToken && (
                <button
                  className="cloud-connect-btn dropbox"
                  onClick={handleConnectDropbox}
                  disabled={isConnecting}
                >
                  <Cloud size={20} />
                  {isConnecting ? 'Connecting...' : 'Connect to Dropbox'}
                </button>
              )}
            </>
          )}

          {/* OneDrive Tab */}
          {activeTab === 'onedrive' && (
            <>
              <div className="cloud-section">
                <h3>Connection Status</h3>
                {oneDriveToken && oneDriveAccount ? (
                  <div className="cloud-connected onedrive">
                    <div className="cloud-account-info">
                      <Check size={20} className="success-icon" />
                      <div>
                        <p className="account-name">{oneDriveAccount.name}</p>
                        <p className="account-email">{oneDriveAccount.email}</p>
                      </div>
                    </div>
                    <button className="cloud-disconnect-btn" onClick={() => handleDisconnect('onedrive')}>
                      <Trash2 size={16} />
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="cloud-disconnected">
                    <AlertCircle size={20} className="warning-icon" />
                    <span>Not connected to OneDrive</span>
                  </div>
                )}
              </div>

              <div className="cloud-section">
                <h3>Microsoft Application (Client) ID</h3>
                <p className="section-description">
                  Register an app at{' '}
                  <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer">
                    Azure App Registrations
                  </a>
                </p>
                <input
                  type="text"
                  value={oneDriveClientId}
                  onChange={(e) => setOneDriveClientId(e.target.value)}
                  placeholder="Enter your Application (Client) ID"
                  className="cloud-input"
                />
              </div>

              <div className="cloud-section">
                <h3>Save Location</h3>
                <div className="cloud-folder-input">
                  <FolderOpen size={18} />
                  <input
                    type="text"
                    value={oneDriveFolder}
                    onChange={(e) => setOneDriveFolder(e.target.value)}
                    placeholder="/Sturgis Projects"
                    className="cloud-input"
                  />
                </div>
              </div>

              {!oneDriveToken && (
                <button
                  className="cloud-connect-btn onedrive"
                  onClick={handleConnectOneDrive}
                  disabled={isConnecting}
                >
                  <HardDrive size={20} />
                  {isConnecting ? 'Connecting...' : 'Connect to OneDrive'}
                </button>
              )}
            </>
          )}
        </div>

        <div className="cloud-settings-footer">
          <button className="cloud-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="cloud-save-btn" onClick={handleSaveSettings}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

// Utility functions for uploading to cloud storage

export const uploadToDropbox = async (
  fileName: string,
  fileContent: Blob | string,
  contentType: string
): Promise<{ success: boolean; error?: string }> => {
  const accessToken = localStorage.getItem('dropbox_access_token');
  const folderPath = localStorage.getItem('dropbox_folder_path') || '/Sturgis Projects';

  if (!accessToken) {
    return { success: false, error: 'Not connected to Dropbox' };
  }

  try {
    const filePath = `${folderPath}/${fileName}`;
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
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export const uploadToOneDrive = async (
  fileName: string,
  fileContent: Blob | string,
  contentType: string
): Promise<{ success: boolean; error?: string }> => {
  const accessToken = localStorage.getItem('onedrive_access_token');
  const folderPath = localStorage.getItem('onedrive_folder_path') || '/Sturgis Projects';

  if (!accessToken) {
    return { success: false, error: 'Not connected to OneDrive' };
  }

  try {
    // Ensure folder path starts with /
    const cleanPath = folderPath.startsWith('/') ? folderPath : `/${folderPath}`;
    const filePath = `${cleanPath}/${fileName}`.replace(/\/+/g, '/');

    const blob = typeof fileContent === 'string'
      ? new Blob([fileContent], { type: contentType })
      : fileContent;

    // OneDrive API endpoint for uploading to a path
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:${filePath}:/content`;

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': contentType,
      },
      body: blob,
    });

    if (response.ok) {
      return { success: true };
    } else {
      const error = await response.json();
      return { success: false, error: error.error?.message || 'Upload failed' };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Check connection status
export const isDropboxConnected = (): boolean => {
  return !!localStorage.getItem('dropbox_access_token');
};

export const isOneDriveConnected = (): boolean => {
  return !!localStorage.getItem('onedrive_access_token');
};

export const isAnyCloudConnected = (): boolean => {
  return isDropboxConnected() || isOneDriveConnected();
};
