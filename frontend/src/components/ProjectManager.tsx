import { useState, useEffect } from 'react';
import { X, Plus, FolderOpen, Trash2, Check } from 'lucide-react';
import { getAllProjects, createNewProject, switchProject, deleteProject } from '../api/client';
import type { ProjectListItem } from '../api/client';
import './ProjectManager.css';

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectChanged: () => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  isOpen,
  onClose,
  onProjectChanged,
}) => {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await getAllProjects();
      setProjects(response.projects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      alert('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    setLoading(true);
    try {
      await createNewProject(newProjectName);
      setNewProjectName('');
      setShowNewProjectInput(false);
      await loadProjects();
      onProjectChanged();
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchProject = async (projectId: string) => {
    setLoading(true);
    try {
      await switchProject(projectId);
      await loadProjects();
      onProjectChanged();
      onClose();
    } catch (error) {
      console.error('Failed to switch project:', error);
      alert('Failed to switch project');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      await deleteProject(projectId);
      await loadProjects();
      onProjectChanged();
    } catch (error: any) {
      console.error('Failed to delete project:', error);
      alert(error.response?.data?.detail || 'Failed to delete project');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="project-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Project Manager</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-content">
          <div className="projects-header">
            <h3>Your Projects</h3>
            <button
              className="action-button primary"
              onClick={() => setShowNewProjectInput(!showNewProjectInput)}
              disabled={loading}
            >
              <Plus size={18} />
              New Project
            </button>
          </div>

          {showNewProjectInput && (
            <div className="new-project-form">
              <input
                type="text"
                placeholder="Enter project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                autoFocus
              />
              <button className="action-button primary" onClick={handleCreateProject}>
                <Check size={18} />
                Create
              </button>
              <button className="action-button" onClick={() => {
                setShowNewProjectInput(false);
                setNewProjectName('');
              }}>
                Cancel
              </button>
            </div>
          )}

          {loading && <div className="loading">Loading...</div>}

          <div className="projects-list">
            {projects.length === 0 && !loading && (
              <div className="empty-state">
                <FolderOpen size={48} />
                <p>No projects found</p>
              </div>
            )}

            {projects.map((project) => (
              <div
                key={project.id}
                className={`project-item ${project.is_active ? 'active' : ''}`}
              >
                <div className="project-info">
                  <div className="project-name">
                    {project.name}
                    {project.is_active && <span className="active-badge">Active</span>}
                  </div>
                  <div className="project-meta">
                    {project.task_count} tasks • {project.start_date}
                  </div>
                </div>
                <div className="project-actions">
                  {!project.is_active && (
                    <button
                      className="action-button"
                      onClick={() => handleSwitchProject(project.id)}
                      disabled={loading}
                      title="Switch to this project"
                    >
                      <FolderOpen size={16} />
                      Open
                    </button>
                  )}
                  {!project.is_active && (
                    <button
                      className="action-button danger"
                      onClick={() => handleDeleteProject(project.id, project.name)}
                      disabled={loading}
                      title="Delete this project"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

