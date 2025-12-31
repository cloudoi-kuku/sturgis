import React, { useState, useEffect } from 'react';
import type { ProjectMetadata } from '../api/client';
import { X, Settings } from 'lucide-react';
import './ProjectMetadataEditor.css';

interface ProjectMetadataEditorProps {
  metadata: ProjectMetadata | undefined;
  isOpen: boolean;
  onClose: () => void;
  onSave: (metadata: ProjectMetadata) => void;
}

export const ProjectMetadataEditor: React.FC<ProjectMetadataEditorProps> = ({
  metadata,
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<ProjectMetadata>({
    name: '',
    start_date: '',
    status_date: '',
  });

  useEffect(() => {
    if (metadata) {
      setFormData({
        name: metadata.name,
        start_date: metadata.start_date,
        status_date: metadata.status_date,
      });
    }
  }, [metadata, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="project-settings-overlay" onClick={onClose}>
      <div className="project-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="project-settings-header">
          <h2>
            <Settings size={20} />
            Project Settings
          </h2>
          <button className="project-settings-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

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
      </div>
    </div>
  );
};
