import React, { useState, useMemo, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GanttChart } from './components/GanttChart';
import { TaskEditor } from './components/TaskEditor';
import { ProjectMetadataEditor } from './components/ProjectMetadataEditor';
import { ProjectManager } from './components/ProjectManager';
import { AIChat } from './components/AIChat';
import { CalendarManager } from './components/CalendarManager';
import { BaselineManager } from './components/BaselineManager';
import { HowToUse } from './components/HowToUse';
import { ExportMenu } from './components/ExportMenu';
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
  getCalendar,
  updateCalendar,
} from './api/client';
import type {
  Task,
  TaskCreate,
  TaskUpdate,
} from './api/client';
import { Upload, Plus, CheckCircle, AlertCircle, Settings, MessageCircle, FolderOpen, Calendar, GitBranch, HelpCircle } from 'lucide-react';
import { parseISO, addDays, differenceInDays } from 'date-fns';
import './App.css';

const queryClient = new QueryClient();

function AppContent() {
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isBaselineManagerOpen, setIsBaselineManagerOpen] = useState(false);
  const [isHowToUseOpen, setIsHowToUseOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<any[]>([]);
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

  const { data: calendarData } = useQuery({
    queryKey: ['calendar'],
    queryFn: getCalendar,
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

  const updateCalendarMutation = useMutation({
    mutationFn: updateCalendar,
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['calendar'] });
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] }); // Refresh tasks as dates may change
      setIsCalendarOpen(false);
    },
  });

  // Listen for project updates from AI chat
  useEffect(() => {
    const handleProjectUpdate = () => {
      // Refresh all data when AI chat modifies the project
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
      queryClientInstance.invalidateQueries({ queryKey: ['metadata'] });
    };

    window.addEventListener('projectUpdated', handleProjectUpdate);
    return () => {
      window.removeEventListener('projectUpdated', handleProjectUpdate);
    };
  }, [queryClientInstance]);

  // Handlers
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('=== File upload triggered ===');
    const file = event.target.files?.[0];
    console.log('Selected file:', file);

    if (file) {
      try {
        console.log('Starting upload mutation...');
        await uploadMutation.mutateAsync(file);
        console.log('Upload successful!');
        alert('Project uploaded successfully!');
      } catch (error) {
        console.error('Upload error:', error);
        alert(`Error uploading file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      console.log('No file selected');
    }

    // Reset the input so the same file can be uploaded again
    event.target.value = '';
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
      setValidationErrors(result.errors || []);
      setValidationWarnings(result.warnings || []);

      const errorCount = result.errors?.length || 0;
      const warningCount = result.warnings?.length || 0;

      if (result.valid && warningCount === 0) {
        alert('✅ Project validation passed! No errors or warnings found.');
      } else if (result.valid && warningCount > 0) {
        alert(`⚠️ Project validation passed with ${warningCount} warning(s). Check the validation panel.`);
      } else {
        alert(`❌ Validation failed with ${errorCount} error(s) and ${warningCount} warning(s). Check the validation panel.`);
      }
    } catch (error) {
      console.error('Validation error:', error);
      alert('Error validating project.');
    }
  };

  const handleProjectChanged = () => {
    // Refresh all data when project changes
    queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
    queryClientInstance.invalidateQueries({ queryKey: ['metadata'] });
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

  // Calculate project duration
  const projectDuration = useMemo(() => {
    if (!tasks || tasks.length === 0 || !metadata) return null;

    // Parse duration from ISO 8601 format (PT8H0M0S) to days
    const parseDuration = (duration: string): number => {
      const match = duration.match(/PT(\d+)H/);
      if (match) {
        const hours = parseInt(match[1]);
        return hours / 8; // Convert hours to days (8-hour workday)
      }
      return 1;
    };

    // Build task map for quick lookup
    const taskMap = new Map(tasks.map(t => [t.outline_number, t]));
    const taskDates = new Map<string, Date>();
    const startDate = parseISO(metadata.start_date);

    // Calculate start dates for all tasks (considering predecessors)
    const calculateStartDate = (task: Task): Date => {
      if (taskDates.has(task.id)) {
        return taskDates.get(task.id)!;
      }

      if (!task.predecessors || task.predecessors.length === 0) {
        taskDates.set(task.id, startDate);
        return startDate;
      }

      let latestEnd = startDate;
      for (const pred of task.predecessors) {
        const predTask = taskMap.get(pred.outline_number);
        if (predTask) {
          const predStart = calculateStartDate(predTask);
          const predDuration = parseDuration(predTask.duration);
          const predEnd = addDays(predStart, predDuration);
          const lagDays = (pred.lag || 0) / 480; // Convert minutes to days
          const adjustedEnd = addDays(predEnd, lagDays);
          if (adjustedEnd > latestEnd) {
            latestEnd = adjustedEnd;
          }
        }
      }

      taskDates.set(task.id, latestEnd);
      return latestEnd;
    };

    // Calculate all task dates
    tasks.forEach(task => calculateStartDate(task));

    // Find the latest end date
    let projectEnd = startDate;
    tasks.forEach(task => {
      const taskStart = taskDates.get(task.id) || startDate;
      const taskDuration = parseDuration(task.duration);
      const taskEnd = addDays(taskStart, taskDuration);
      if (taskEnd > projectEnd) {
        projectEnd = taskEnd;
      }
    });

    const totalDays = differenceInDays(projectEnd, startDate);
    return {
      days: totalDays,
      startDate: metadata.start_date,
      endDate: projectEnd.toISOString().split('T')[0]
    };
  }, [tasks, metadata]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <img src="/sturgis-logo.png" alt="Sturgis Logo" className="app-logo" />
          <h1>Project Configuration Tool</h1>
        </div>
        <div className="header-actions">
          <button
            className="action-button"
            onClick={() => setIsProjectManagerOpen(true)}
            title="Manage Projects"
          >
            <FolderOpen size={18} />
            Projects
          </button>

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

          <ExportMenu
            tasks={tasks}
            metadata={metadata}
            onExportXML={handleExport}
          />

          <button
            className="action-button ai-chat-button"
            onClick={() => setIsChatOpen(true)}
            title="AI Assistant"
          >
            <MessageCircle size={18} />
            AI Chat
          </button>

          <button
            className="action-button"
            onClick={() => setIsHowToUseOpen(true)}
            title="How to Use"
          >
            <HelpCircle size={18} />
            Help
          </button>
        </div>
      </header>

      {metadata && (
        <div className="project-info">
          <div className="project-metadata">
            <h2>{metadata.name}</h2>
            <p>
              Start: {metadata.start_date} | Status: {metadata.status_date}
              {projectDuration && (
                <> | Duration: <strong>{projectDuration.days} days</strong> (End: {projectDuration.endDate})</>
              )}
            </p>
          </div>
          <div className="project-actions">
            <button className="settings-button" onClick={() => setIsBaselineManagerOpen(true)} title="Baseline Manager">
              <GitBranch size={18} />
            </button>
            <button className="settings-button" onClick={() => setIsCalendarOpen(true)} title="Calendar Settings">
              <Calendar size={18} />
            </button>
            <button className="settings-button" onClick={() => setIsMetadataOpen(true)} title="Project Settings">
              <Settings size={18} />
            </button>
          </div>
        </div>
      )}

      {(validationErrors.length > 0 || validationWarnings.length > 0) && (
        <div className="validation-panel">
          {validationErrors.length > 0 && (
            <>
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
            </>
          )}

          {validationWarnings.length > 0 && (
            <>
              <div className="validation-header validation-warning-header">
                <AlertCircle size={18} />
                <h3>Validation Warnings ({validationWarnings.length})</h3>
              </div>
              <ul className="validation-warnings">
                {validationWarnings.map((warning, index) => (
                  <li key={index}>
                    <strong>{warning.field}:</strong> {warning.message}
                    {warning.task_id && <span className="task-id"> (Task: {warning.task_id})</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
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
        projectId={metadata?.project_id}
      />

      <ProjectManager
        isOpen={isProjectManagerOpen}
        onClose={() => setIsProjectManagerOpen(false)}
        onProjectChanged={handleProjectChanged}
      />

      <CalendarManager
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        calendar={calendarData}
        onSave={async (calendar) => {
          await updateCalendarMutation.mutateAsync(calendar);
        }}
      />

      <BaselineManager
        isOpen={isBaselineManagerOpen}
        onClose={() => setIsBaselineManagerOpen(false)}
        onBaselineChanged={() => {
          queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
        }}
      />

      <HowToUse
        isOpen={isHowToUseOpen}
        onClose={() => setIsHowToUseOpen(false)}
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
