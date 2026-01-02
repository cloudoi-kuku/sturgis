import React, { useState, useEffect } from 'react';
import type { ProjectMetadata } from '../api/client';
import { X, Settings, Cloud, Check, AlertCircle, Trash2, FolderOpen, HardDrive } from 'lucide-react';
import './ProjectMetadataEditor.css';

interface ProjectMetadataEditorProps {
  metadata: ProjectMetadata | undefined;
  isOpen: boolean;
  onClose: () => void;
  onSave: (metadata: ProjectMetadata) => void;
  initialTab?: 'project' | 'cloud';
}

type StorageProvider = 'dropbox' | 'onedrive';

export const ProjectMetadataEditor: React.FC<ProjectMetadataEditorProps> = ({
  metadata,
  isOpen,
  onClose,
  onSave,
  initialTab = 'project',
}) => {
  const [activeTab, setActiveTab] = useState<'project' | 'cloud'>(initialTab);
  const [formData, setFormData] = useState<ProjectMetadata>({
    name: '',
    start_date: '',
    status_date: '',
  });

  // Cloud storage state
  const [cloudTab, setCloudTab] = useState<StorageProvider>('dropbox');
  const [dropboxToken, setDropboxToken] = useState<string | null>(null);
  const [dropboxFolder, setDropboxFolder] = useState('/Sturgis Projects');
  const [dropboxAppKey, setDropboxAppKey] = useState('');
  const [dropboxAccount, setDropboxAccount] = useState<{ name: string; email: string } | null>(null);
  const [oneDriveToken, setOneDriveToken] = useState<string | null>(null);
  const [oneDriveFolder, setOneDriveFolder] = useState('/Sturgis Projects');
  const [oneDriveClientId, setOneDriveClientId] = useState('');
  const [oneDriveAccount, setOneDriveAccount] = useState<{ name: string; email: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (metadata) {
      setFormData({
        name: metadata.name,
        start_date: metadata.start_date,
        status_date: metadata.status_date,
      });
    }
  }, [metadata, isOpen]);

  // Reset to initial tab when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Load cloud settings from localStorage
  useEffect(() => {
    const savedDropboxToken = localStorage.getItem('dropbox_access_token');
    const savedDropboxFolder = localStorage.getItem('dropbox_folder_path');
    const savedDropboxAppKey = localStorage.getItem('dropbox_app_key');
    if (savedDropboxToken) setDropboxToken(savedDropboxToken);
    if (savedDropboxFolder) setDropboxFolder(savedDropboxFolder);
    if (savedDropboxAppKey) setDropboxAppKey(savedDropboxAppKey);

    const savedOneDriveToken = localStorage.getItem('onedrive_access_token');
    const savedOneDriveFolder = localStorage.getItem('onedrive_folder_path');
    const savedOneDriveClientId = localStorage.getItem('onedrive_client_id');
    if (savedOneDriveToken) setOneDriveToken(savedOneDriveToken);
    if (savedOneDriveFolder) setOneDriveFolder(savedOneDriveFolder);
    if (savedOneDriveClientId) setOneDriveClientId(savedOneDriveClientId);
  }, []);

  // Fetch account info
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

  const handleSaveCloudSettings = () => {
    localStorage.setItem('dropbox_folder_path', dropboxFolder);
    localStorage.setItem('dropbox_app_key', dropboxAppKey);
    localStorage.setItem('onedrive_folder_path', oneDriveFolder);
    localStorage.setItem('onedrive_client_id', oneDriveClientId);
    alert('Cloud storage settings saved!');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="project-settings-overlay" onClick={onClose}>
      <div className="project-settings-modal project-settings-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="project-settings-header">
          <h2>
            <Settings size={20} />
            Project Settings
          </h2>
          <button className="project-settings-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="project-settings-tabs">
          <button
            className={`project-settings-tab ${activeTab === 'project' ? 'active' : ''}`}
            onClick={() => setActiveTab('project')}
          >
            <Settings size={16} />
            Project Info
          </button>
          <button
            className={`project-settings-tab ${activeTab === 'cloud' ? 'active' : ''}`}
            onClick={() => setActiveTab('cloud')}
          >
            <Cloud size={16} />
            Cloud Storage
            {(dropboxToken || oneDriveToken) && <Check size={12} className="tab-connected-icon" />}
          </button>
        </div>

        {/* Project Info Tab */}
        {activeTab === 'project' && (
          <form onSubmit={handleSubmit} className="project-settings-form">
            <div className="project-settings-group">
              <label>Project Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter project name"
                required
              />
            </div>

            <div className="project-settings-group">
              <label>Start Date</label>
              <input
                type="datetime-local"
                value={formData.start_date ? formData.start_date.slice(0, 16) : ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value) {
                    setFormData({ ...formData, start_date: value + ':00' });
                  }
                }}
                required
              />
              <small className="project-settings-hint">Project start date and time</small>
            </div>

            <div className="project-settings-group">
              <label>Status Date</label>
              <input
                type="datetime-local"
                value={formData.status_date ? formData.status_date.slice(0, 16) : ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value) {
                    setFormData({ ...formData, status_date: value + ':00' });
                  }
                }}
                required
              />
              <small className="project-settings-hint">Current project status date (for progress tracking)</small>
            </div>

            <div className="project-settings-footer">
              <button type="button" className="project-settings-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="project-settings-save">
                Save Changes
              </button>
            </div>
          </form>
        )}

        {/* Cloud Storage Tab */}
        {activeTab === 'cloud' && (
          <div className="project-settings-cloud">
            {/* Cloud Provider Tabs */}
            <div className="cloud-provider-tabs">
              <button
                className={`cloud-provider-tab ${cloudTab === 'dropbox' ? 'active' : ''}`}
                onClick={() => setCloudTab('dropbox')}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M6 2L0 6l6 4-6 4 6 4 6-4-6-4 6-4-6-4zm12 0l-6 4 6 4-6 4 6 4 6-4-6-4 6-4-6-4zM6 14l6 4 6-4-6 4-6-4z"/>
                </svg>
                Dropbox
                {dropboxToken && <Check size={12} className="provider-connected" />}
              </button>
              <button
                className={`cloud-provider-tab ${cloudTab === 'onedrive' ? 'active' : ''}`}
                onClick={() => setCloudTab('onedrive')}
              >
                <HardDrive size={16} />
                OneDrive
                {oneDriveToken && <Check size={12} className="provider-connected" />}
              </button>
            </div>

            {/* Dropbox Settings */}
            {cloudTab === 'dropbox' && (
              <div className="cloud-provider-content">
                <div className="cloud-section">
                  <h4>Connection Status</h4>
                  {dropboxToken && dropboxAccount ? (
                    <div className="cloud-connected-status">
                      <div className="cloud-account-info">
                        <Check size={18} className="success-icon" />
                        <div>
                          <p className="account-name">{dropboxAccount.name}</p>
                          <p className="account-email">{dropboxAccount.email}</p>
                        </div>
                      </div>
                      <button className="cloud-disconnect-btn" onClick={() => handleDisconnect('dropbox')}>
                        <Trash2 size={14} />
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="cloud-disconnected-status">
                      <AlertCircle size={18} className="warning-icon" />
                      <span>Not connected to Dropbox</span>
                    </div>
                  )}
                </div>

                <div className="cloud-section">
                  <h4>Dropbox App Key</h4>
                  <p className="cloud-hint">
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
                  <h4>Save Location</h4>
                  <div className="cloud-folder-input">
                    <FolderOpen size={16} />
                    <input
                      type="text"
                      value={dropboxFolder}
                      onChange={(e) => setDropboxFolder(e.target.value)}
                      placeholder="/Sturgis Projects"
                    />
                  </div>
                </div>

                {!dropboxToken && (
                  <button
                    className="cloud-connect-btn dropbox"
                    onClick={handleConnectDropbox}
                    disabled={isConnecting}
                  >
                    <Cloud size={18} />
                    {isConnecting ? 'Connecting...' : 'Connect to Dropbox'}
                  </button>
                )}
              </div>
            )}

            {/* OneDrive Settings */}
            {cloudTab === 'onedrive' && (
              <div className="cloud-provider-content">
                <div className="cloud-section">
                  <h4>Connection Status</h4>
                  {oneDriveToken && oneDriveAccount ? (
                    <div className="cloud-connected-status onedrive">
                      <div className="cloud-account-info">
                        <Check size={18} className="success-icon" />
                        <div>
                          <p className="account-name">{oneDriveAccount.name}</p>
                          <p className="account-email">{oneDriveAccount.email}</p>
                        </div>
                      </div>
                      <button className="cloud-disconnect-btn" onClick={() => handleDisconnect('onedrive')}>
                        <Trash2 size={14} />
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <div className="cloud-disconnected-status">
                      <AlertCircle size={18} className="warning-icon" />
                      <span>Not connected to OneDrive</span>
                    </div>
                  )}
                </div>

                <div className="cloud-section">
                  <h4>Microsoft Application (Client) ID</h4>
                  <p className="cloud-hint">
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
                  <h4>Save Location</h4>
                  <div className="cloud-folder-input">
                    <FolderOpen size={16} />
                    <input
                      type="text"
                      value={oneDriveFolder}
                      onChange={(e) => setOneDriveFolder(e.target.value)}
                      placeholder="/Sturgis Projects"
                    />
                  </div>
                </div>

                {!oneDriveToken && (
                  <button
                    className="cloud-connect-btn onedrive"
                    onClick={handleConnectOneDrive}
                    disabled={isConnecting}
                  >
                    <HardDrive size={18} />
                    {isConnecting ? 'Connecting...' : 'Connect to OneDrive'}
                  </button>
                )}
              </div>
            )}

            <div className="project-settings-footer">
              <button type="button" className="project-settings-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="project-settings-save" onClick={handleSaveCloudSettings}>
                Save Cloud Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
