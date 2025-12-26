import React, { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GanttChart } from './components/GanttChart';
import { TaskEditor } from './components/TaskEditor';
import { ProjectMetadataEditor } from './components/ProjectMetadataEditor';
import { AIChat } from './components/AIChat';
import {
  uploadProject,
  getTasks,
  getProjectMetadata,
  updateProjectMetadata,
  createTask,
  updateTask,
  deleteTask,
  validateProject,
  exportProject,
} from './api/client';
import type {
  Task,
  TaskCreate,
  TaskUpdate,
  ProjectMetadata,
} from './api/client';
import { Upload, Plus, Download, CheckCircle, AlertCircle, Settings, MessageCircle } from 'lucide-react';
import './App.css';

const queryClient = new QueryClient();

function AppContent() {
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const queryClientInstance = useQueryClient();

  // Queries
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
    enabled: true,
    retry: false,
  });

  const { data: metadata } = useQuery({
    queryKey: ['metadata'],
    queryFn: getProjectMetadata,
    retry: false,
  });

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: uploadProject,
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
      queryClientInstance.invalidateQueries({ queryKey: ['metadata'] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
      setIsEditorOpen(false);
      setSelectedTask(undefined);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: TaskUpdate }) =>
      updateTask(taskId, updates),
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
      setIsEditorOpen(false);
      setSelectedTask(undefined);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const updateMetadataMutation = useMutation({
    mutationFn: updateProjectMetadata,
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['metadata'] });
      setIsMetadataOpen(false);
    },
  });

  // Handlers
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        await uploadMutation.mutateAsync(file);
      } catch (error) {
        console.error('Upload error:', error);
        alert('Error uploading file. Please try again.');
      }
    }
  };

  const handleCreateTask = () => {
    setSelectedTask(undefined);
    setIsEditorOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setIsEditorOpen(true);
  };

  const handleSaveTask = async (taskData: TaskCreate | TaskUpdate) => {
    if (selectedTask) {
      await updateTaskMutation.mutateAsync({
        taskId: selectedTask.id,
        updates: taskData as TaskUpdate,
      });
    } else {
      await createTaskMutation.mutateAsync(taskData as TaskCreate);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTaskMutation.mutateAsync(taskId);
      setIsEditorOpen(false);
      setSelectedTask(undefined);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error deleting task. Please try again.');
    }
  };

  const handleValidate = async () => {
    try {
      const result = await validateProject();
      setValidationErrors(result.errors);
      if (result.valid) {
        alert('✅ Project validation passed! No errors found.');
      } else {
        alert(`❌ Validation failed with ${result.errors.length} error(s). Check the validation panel.`);
      }
    } catch (error) {
      console.error('Validation error:', error);
      alert('Error validating project.');
    }
  };

  const handleExport = async () => {
    try {
      // Validate first
      const validation = await validateProject();
      if (!validation.valid) {
        const proceed = confirm(
          `Project has ${validation.errors.length} validation error(s). Export anyway?`
        );
        if (!proceed) return;
      }

      const blob = await exportProject();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${metadata?.name || 'project'}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Export error:', error);

      // Extract error message from response
      let errorMessage = 'Error exporting project.';
      if (error.response?.data) {
        // If the error response is a Blob (from blob responseType), convert it to text
        if (error.response.data instanceof Blob) {
          try {
            const text = await error.response.data.text();
            const errorData = JSON.parse(text);
            errorMessage = errorData.detail || errorMessage;
          } catch (e) {
            // If parsing fails, use default message
          }
        } else if (typeof error.response.data === 'object') {
          errorMessage = error.response.data.detail || errorMessage;
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert(errorMessage);
    }
  };

  const tasks = tasksData?.tasks || [];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <img src="/sturgis-logo.png" alt="Sturgis Logo" className="app-logo" />
          <h1>MS Project Configuration Tool</h1>
        </div>
        <div className="header-actions">
          <label className="upload-button">
            <Upload size={18} />
            Upload XML
            <input type="file" accept=".xml" onChange={handleFileUpload} hidden />
          </label>

          <button className="action-button" onClick={handleCreateTask} disabled={!metadata}>
            <Plus size={18} />
            New Task
          </button>

          <button className="action-button" onClick={handleValidate} disabled={!metadata}>
            <CheckCircle size={18} />
            Validate
          </button>

          <button className="action-button primary" onClick={handleExport} disabled={!metadata}>
            <Download size={18} />
            Export XML
          </button>

          <button
            className="action-button ai-chat-button"
            onClick={() => setIsChatOpen(true)}
            title="AI Assistant"
          >
            <MessageCircle size={18} />
            AI Chat
          </button>
        </div>
      </header>

      {metadata && (
        <div className="project-info">
          <div className="project-metadata">
            <h2>{metadata.name}</h2>
            <p>Start: {metadata.start_date} | Status: {metadata.status_date}</p>
          </div>
          <button className="settings-button" onClick={() => setIsMetadataOpen(true)}>
            <Settings size={18} />
          </button>
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="validation-panel">
          <div className="validation-header">
            <AlertCircle size={18} />
            <h3>Validation Errors ({validationErrors.length})</h3>
          </div>
          <ul className="validation-errors">
            {validationErrors.map((error, index) => (
              <li key={index}>
                <strong>{error.field}:</strong> {error.message}
                {error.task_id && <span className="task-id"> (Task: {error.task_id})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <main className="app-main">
        {tasksLoading && <div className="loading">Loading tasks...</div>}

        {!metadata && !tasksLoading && (
          <div className="empty-state">
            <Upload size={48} />
            <h2>No Project Loaded</h2>
            <p>Upload an MS Project XML file to get started</p>
          </div>
        )}

        {metadata && tasks.length > 0 && (
          <GanttChart
            tasks={tasks}
            projectStartDate={metadata.start_date}
            onTaskClick={handleEditTask}
            onTaskEdit={handleEditTask}
          />
        )}

        {metadata && tasks.length === 0 && !tasksLoading && (
          <div className="empty-state">
            <Plus size={48} />
            <h2>No Tasks</h2>
            <p>Create your first task to get started</p>
            <button className="action-button primary" onClick={handleCreateTask}>
              <Plus size={18} />
              Create Task
            </button>
          </div>
        )}
      </main>

      <TaskEditor
        task={selectedTask}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setSelectedTask(undefined);
        }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        existingTasks={tasks}
      />

      <ProjectMetadataEditor
        metadata={metadata}
        isOpen={isMetadataOpen}
        onClose={() => setIsMetadataOpen(false)}
        onSave={async (updatedMetadata) => {
          await updateMetadataMutation.mutateAsync(updatedMetadata);
        }}
      />

      <AIChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
