import { useState, useEffect, useRef } from 'react';
import { X, Plus, FolderOpen, Trash2, Check, Briefcase, Calendar, ListTodo, Share2, Lock, Users, Wand2, FileText, Upload } from 'lucide-react';
import { getAllProjects, createNewProject, switchProject, deleteProject, updateProjectSharing, generateProject } from '../api/client';
import type { ProjectListItem } from '../api/client';
import './ProjectManager.css';

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectChanged: () => void | Promise<void>;
  onUploadXml?: (file: File) => Promise<void>;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  isOpen,
  onClose,
  onProjectChanged,
  onUploadXml,
}) => {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiDescription, setAIDescription] = useState('');
  const [aiProjectType, setAIProjectType] = useState('commercial');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setShowCreateOptions(false);
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

  const handleGenerateProject = async () => {
    if (!aiDescription.trim()) {
      alert('Please enter a project description');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateProject(aiDescription, aiProjectType);
      if (result.success) {
        alert(`✅ ${result.message}`);
        setAIDescription('');
        setShowAIGenerator(false);
        setShowCreateOptions(false);
        // Wait for data refresh to complete
        await onProjectChanged();
        await loadProjects();
        onClose(); // Close the modal after successful generation
      } else {
        alert(`❌ Generation failed: ${result.message}`);
      }
    } catch (error: any) {
      console.error('Failed to generate project:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
      alert(`❌ Failed to generate project: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onUploadXml) return;

    setIsUploading(true);
    try {
      await onUploadXml(file);
      setShowCreateOptions(false);
      // Wait for data refresh to complete
      await onProjectChanged();
      await loadProjects();
      onClose(); // Close the modal after successful upload
    } catch (error: any) {
      console.error('Failed to upload XML:', error);
      alert(`❌ Failed to upload: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSwitchProject = async (projectId: string) => {
    setLoading(true);
    try {
      await switchProject(projectId);
      // Close modal immediately, refresh happens in background
      onClose();
      onProjectChanged();
    } catch (error) {
      console.error('Failed to switch project:', error);
      alert('Failed to switch project');
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
              onClick={() => setShowCreateOptions(!showCreateOptions)}
              disabled={loading || isGenerating}
            >
              <Plus size={16} />
              New Project
            </button>
          </div>

          {/* Create Options: Upload, Manual, or AI */}
          {showCreateOptions && !showNewProjectInput && !showAIGenerator && (
            <div className="create-options">
              <div className="create-option" onClick={handleUploadClick} style={{ opacity: isUploading ? 0.6 : 1 }}>
                <div className="create-option-icon upload">
                  <Upload size={24} />
                </div>
                <div className="create-option-content">
                  <h4>{isUploading ? 'Uploading...' : 'Upload MS Project XML'}</h4>
                  <p>Import an existing schedule from MS Project</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  onChange={handleFileChange}
                  hidden
                />
              </div>
              <div className="create-option" onClick={() => setShowNewProjectInput(true)}>
                <div className="create-option-icon manual">
                  <FileText size={24} />
                </div>
                <div className="create-option-content">
                  <h4>Create Empty Project</h4>
                  <p>Start with a blank project and add tasks manually</p>
                </div>
              </div>
              <div className="create-option" onClick={() => setShowAIGenerator(true)}>
                <div className="create-option-icon ai">
                  <Wand2 size={24} />
                </div>
                <div className="create-option-content">
                  <h4>Generate with AI</h4>
                  <p>Describe your project and let AI create the schedule</p>
                </div>
              </div>
            </div>
          )}

          {/* Manual Project Creation Form */}
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
              <button className="action-button primary" onClick={handleCreateProject} disabled={loading}>
                <Check size={16} />
                Create
              </button>
              <button className="action-button" onClick={() => {
                setShowNewProjectInput(false);
                setNewProjectName('');
              }}>
                Back
              </button>
            </div>
          )}

          {/* AI Project Generator Form */}
          {showAIGenerator && (
            <div className="ai-generator-form">
              <h4>Describe Your Project</h4>
              <textarea
                placeholder="E.g., Create a 3-bedroom residential home with garage, 2000 sq ft, standard finishes..."
                value={aiDescription}
                onChange={(e) => setAIDescription(e.target.value)}
                rows={3}
                autoFocus
              />
              <div className="ai-generator-options">
                <label>Project Type:</label>
                <select
                  value={aiProjectType}
                  onChange={(e) => setAIProjectType(e.target.value)}
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="renovation">Renovation</option>
                </select>
              </div>
              <div className="ai-generator-actions">
                <button
                  className="action-button primary"
                  onClick={handleGenerateProject}
                  disabled={isGenerating || !aiDescription.trim()}
                >
                  {isGenerating ? (
                    <>
                      <div className="spinner" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 size={16} />
                      Generate Project
                    </>
                  )}
                </button>
                <button
                  className="action-button"
                  onClick={() => {
                    setShowAIGenerator(false);
                    setAIDescription('');
                  }}
                  disabled={isGenerating}
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {loading && projects.length === 0 && <div className="loading">Loading...</div>}

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
