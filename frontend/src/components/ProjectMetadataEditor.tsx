import React, { useState, useEffect } from 'react';
import type { ProjectMetadata } from '../api/client';
import { X } from 'lucide-react';

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Project Settings</h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="task-form">
          <div className="form-group">
            <label>Project Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Start Date *</label>
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
            <small className="form-hint">Project start date and time</small>
          </div>

          <div className="form-group">
            <label>Status Date *</label>
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
            <small className="form-hint">Current project status date</small>
          </div>

          <div className="modal-footer">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="save-button">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

