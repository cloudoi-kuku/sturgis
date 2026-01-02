import { useState, useEffect } from 'react';
import { X, Plus, FolderOpen, Trash2, Check, Briefcase, Calendar, ListTodo, Share2, Lock, Users } from 'lucide-react';
import { getAllProjects, createNewProject, switchProject, deleteProject, updateProjectSharing } from '../api/client';
import type { ProjectListItem } from '../api/client';
import './ProjectManager.css';

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectChanged: () => void | Promise<void>;
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
      // Wait for data refresh to complete
      await onProjectChanged();
      await loadProjects();
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
      // Wait for data refresh before closing modal
      await onProjectChanged();
      await loadProjects();
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
      // Wait for data refresh to complete
      await onProjectChanged();
      await loadProjects();
    } catch (error: any) {
      console.error('Failed to delete project:', error);
      alert(error.response?.data?.detail || 'Failed to delete project');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSharing = async (project: ProjectListItem) => {
    const newSharedState = !project.is_shared;
    setLoading(true);
    try {
      await updateProjectSharing(project.id, newSharedState);
      await loadProjects();
    } catch (error: any) {
      console.error('Failed to update project sharing:', error);
      alert(error.response?.data?.detail || 'Failed to update sharing');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="project-manager-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <Briefcase size={20} />
            Project Manager
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
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
              <Plus size={16} />
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
                <Check size={16} />
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
                    {project.is_shared && (
                      <span className="shared-badge" title="Shared with others">
                        <Users size={10} />
                        Shared
                      </span>
                    )}
                    {project.is_owned === false && (
                      <span className="others-badge" title="Owned by another user">
                        <Share2 size={10} />
                        From Others
                      </span>
                    )}
                  </div>
                  <div className="project-meta">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ListTodo size={12} />
                      {project.task_count} tasks
                    </span>
                    <span style={{ margin: '0 0.5rem', color: '#cbd5e1' }}>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={12} />
                      {project.start_date}
                    </span>
                  </div>
                </div>
                <div className="project-actions">
                  {/* Share/Unshare button - only for owned projects */}
                  {project.is_owned !== false && (
                    <button
                      className={`action-button ${project.is_shared ? 'shared' : ''}`}
                      onClick={() => handleToggleSharing(project)}
                      disabled={loading}
                      title={project.is_shared ? 'Make Private' : 'Share with Others'}
                    >
                      {project.is_shared ? <Lock size={14} /> : <Share2 size={14} />}
                    </button>
                  )}
                  {!project.is_active && (
                    <button
                      className="action-button"
                      onClick={() => handleSwitchProject(project.id)}
                      disabled={loading}
                      title="Switch to this project"
                    >
                      <FolderOpen size={14} />
                      Open
                    </button>
                  )}
                  {!project.is_active && project.is_owned !== false && (
                    <button
                      className="action-button danger"
                      onClick={() => handleDeleteProject(project.id, project.name)}
                      disabled={loading}
                      title="Delete this project"
                    >
                      <Trash2 size={14} />
                      Delete
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
