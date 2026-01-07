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
import { uploadToDropbox, uploadToOneDrive, isDropboxConnected, isOneDriveConnected } from './components/CloudStorageSettings';
import { Button } from './components/ui/button';
import {
  uploadProject,
  getTasks,
  getProjectMetadata,
  updateProjectMetadata,
  createTask,
  updateTask,
  deleteTask,
  ungroupTask,
  getTaskChildrenCount,
  validateProject,
  exportProject,
  getCalendar,
  updateCalendar,
  saveProject,
  recalculateDates,
} from './api/client';
import type {
  Task,
  TaskCreate,
  TaskUpdate,
} from './api/client';
import { Upload, Plus, CheckCircle, AlertCircle, Settings, MessageCircle, FolderOpen, Calendar, GitBranch, HelpCircle, Save, Cloud, LogOut, User, ChevronDown, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { parseISO, addDays, differenceInDays, format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import './App.css';
import './components/GanttChartEnhancements.css';
import './ui-overrides.css';

const queryClient = new QueryClient();

function AppContent() {
  const { user, logout } = useAuth();
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isBaselineManagerOpen, setIsBaselineManagerOpen] = useState(false);
  const [isHowToUseOpen, setIsHowToUseOpen] = useState(false);
  const [isSavingToDropbox, setIsSavingToDropbox] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'project' | 'cloud'>('project');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<any[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    isOpen: boolean;
    task: Task | null;
    childrenCount: number;
  }>({ isOpen: false, task: null, childrenCount: 0 });
  const [quickAddContext, setQuickAddContext] = useState<{
    position: 'before' | 'after' | 'child';
    referenceTask: Task;
  } | null>(null);
  const queryClientInstance = useQueryClient();

  // Warn user about unsaved changes when leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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

  // Mutations - all mutations mark project as having unsaved changes
  const uploadMutation = useMutation({
    mutationFn: uploadProject,
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
      queryClientInstance.invalidateQueries({ queryKey: ['metadata'] });
      setHasUnsavedChanges(false); // Fresh upload is saved
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
      setIsEditorOpen(false);
      setSelectedTask(undefined);
      setHasUnsavedChanges(true); // Mark as unsaved
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: TaskUpdate }) =>
      updateTask(taskId, updates),
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
      setIsEditorOpen(false);
      setSelectedTask(undefined);
      setHasUnsavedChanges(true); // Mark as unsaved
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
      setHasUnsavedChanges(true); // Mark as unsaved
    },
  });

  const ungroupTaskMutation = useMutation({
    mutationFn: ungroupTask,
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
      setHasUnsavedChanges(true); // Mark as unsaved
    },
  });

  const updateMetadataMutation = useMutation({
    mutationFn: updateProjectMetadata,
    onSuccess: async (response) => {
      // Backend automatically recalculates task dates when start_date changes
      if (response.dates_recalculated) {
        console.log('Task dates were automatically recalculated by backend');
      }
      // Refetch both metadata and tasks to ensure UI is updated
      await Promise.all([
        queryClientInstance.refetchQueries({ queryKey: ['metadata'] }),
        queryClientInstance.refetchQueries({ queryKey: ['tasks'] }),
      ]);
      setIsMetadataOpen(false);
      setHasUnsavedChanges(true); // Mark as unsaved
    },
  });

  const updateCalendarMutation = useMutation({
    mutationFn: updateCalendar,
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['calendar'] });
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] }); // Refresh tasks as dates may change
      setIsCalendarOpen(false);
      setHasUnsavedChanges(true); // Mark as unsaved
    },
  });

  // Listen for project updates from AI chat
  useEffect(() => {
    const handleProjectUpdate = () => {
      // Refresh all data when AI chat modifies the project
      queryClientInstance.invalidateQueries({ queryKey: ['tasks'] });
      queryClientInstance.invalidateQueries({ queryKey: ['metadata'] });
      setHasUnsavedChanges(true); // AI changes are unsaved
    };

    window.addEventListener('projectUpdated', handleProjectUpdate);
    return () => {
      window.removeEventListener('projectUpdated', handleProjectUpdate);
    };
  }, [queryClientInstance]);

  // Manual Save Handler
  const handleSave = async () => {
    if (!metadata) {
      alert('No project loaded');
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveProject();
      if (result.success) {
        setHasUnsavedChanges(false);
        alert(`Project saved successfully! (${result.task_count} tasks)`);
      } else {
        alert(`Save failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert(`Error saving project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecalculateDates = async () => {
    if (!metadata) {
      alert('No project loaded');
      return;
    }

    setIsRecalculating(true);
    try {
      const result = await recalculateDates();
      if (result.success) {
        // Refresh tasks to show updated dates
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        setHasUnsavedChanges(true);
        alert(`Dates recalculated for ${result.tasks_updated} tasks based on dependencies.\n\nClick Save to persist changes.`);
      } else {
        alert(`Recalculation failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Recalculate dates error:', error);
      alert(`Error recalculating dates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRecalculating(false);
    }
  };

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
    setQuickAddContext(null);
    setIsEditorOpen(true);
  };

  // Quick add task from context menu or hover buttons
  const handleQuickAddTask = (position: 'before' | 'after' | 'child', referenceTask: Task) => {
    setSelectedTask(undefined);
    setQuickAddContext({ position, referenceTask });
    setIsEditorOpen(true);
  };

  // Delete task from context menu (accepts Task instead of taskId)
  const handleDeleteTaskFromMenu = (task: Task) => {
    handleDeleteTask(task.id);
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
    // Find the task to check if it's a summary
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      alert('Task not found');
      return;
    }

    // If it's a summary task, show confirmation dialog with options
    if (task.summary) {
      try {
        const childInfo = await getTaskChildrenCount(taskId);
        if (childInfo.children_count > 0) {
          setDeleteConfirmDialog({
            isOpen: true,
            task: task,
            childrenCount: childInfo.children_count
          });
          return;
        }
      } catch (error) {
        console.error('Error getting children count:', error);
      }
    }

    // For non-summary tasks or summary tasks with no children, delete directly
    try {
      await deleteTaskMutation.mutateAsync(taskId);
      setIsEditorOpen(false);
      setSelectedTask(undefined);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error deleting task. Please try again.');
    }
  };

  const handleConfirmDelete = async (action: 'delete-all' | 'ungroup') => {
    const task = deleteConfirmDialog.task;
    if (!task) return;

    try {
      if (action === 'delete-all') {
        await deleteTaskMutation.mutateAsync(task.id);
      } else {
        await ungroupTaskMutation.mutateAsync(task.id);
      }
      setIsEditorOpen(false);
      setSelectedTask(undefined);
    } catch (error) {
      console.error('Delete/Ungroup error:', error);
      alert('Error processing request. Please try again.');
    } finally {
      setDeleteConfirmDialog({ isOpen: false, task: null, childrenCount: 0 });
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

  const handleProjectChanged = async () => {
    // Refresh all data when project changes - use refetchQueries to wait for completion
    await Promise.all([
      queryClientInstance.refetchQueries({ queryKey: ['tasks'] }),
      queryClientInstance.refetchQueries({ queryKey: ['metadata'] }),
      queryClientInstance.refetchQueries({ queryKey: ['calendar'] }),
    ]);
    // Reset unsaved changes flag when switching to a different project
    // (the project was loaded from the database, so it's already saved)
    setHasUnsavedChanges(false);
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

  // Save to Cloud Storage (Dropbox and/or OneDrive)
  const handleSaveToCloud = async () => {
    if (!metadata) {
      alert('No project loaded');
      return;
    }

    const dropboxConnected = isDropboxConnected();
    const oneDriveConnected = isOneDriveConnected();

    if (!dropboxConnected && !oneDriveConnected) {
      const connect = confirm('No cloud storage connected. Would you like to configure cloud storage settings?');
      if (connect) {
        setSettingsInitialTab('cloud');
        setIsMetadataOpen(true);
      }
      return;
    }

    setIsSavingToDropbox(true);

    try {
      // Generate date prefix
      const datePrefix = format(new Date(), 'yyyy-MM-dd');
      const projectName = metadata.name || 'project';
      const baseFileName = `${datePrefix}_${projectName}`;

      // 1. Export XML
      let xmlBlob: Blob;
      try {
        xmlBlob = await exportProject();
      } catch (error) {
        throw new Error('Failed to generate XML file');
      }

      // 2. Generate PDF
      const pdfBlob = await generateProjectPDF();

      const results: string[] = [];
      const errors: string[] = [];

      // 3. Upload to Dropbox if connected
      if (dropboxConnected) {
        const xmlResult = await uploadToDropbox(`${baseFileName}.xml`, xmlBlob, 'application/xml');
        const pdfResult = await uploadToDropbox(`${baseFileName}.pdf`, pdfBlob, 'application/pdf');

        if (xmlResult.success && pdfResult.success) {
          results.push('Dropbox: XML + PDF saved');
        } else {
          if (!xmlResult.success) errors.push(`Dropbox XML: ${xmlResult.error}`);
          if (!pdfResult.success) errors.push(`Dropbox PDF: ${pdfResult.error}`);
        }
      }

      // 4. Upload to OneDrive if connected
      if (oneDriveConnected) {
        const xmlResult = await uploadToOneDrive(`${baseFileName}.xml`, xmlBlob, 'application/xml');
        const pdfResult = await uploadToOneDrive(`${baseFileName}.pdf`, pdfBlob, 'application/pdf');

        if (xmlResult.success && pdfResult.success) {
          results.push('OneDrive: XML + PDF saved');
        } else {
          if (!xmlResult.success) errors.push(`OneDrive XML: ${xmlResult.error}`);
          if (!pdfResult.success) errors.push(`OneDrive PDF: ${pdfResult.error}`);
        }
      }

      // Show results
      if (results.length > 0 && errors.length === 0) {
        alert(`Successfully saved to cloud!\n\n${results.join('\n')}\n\nFiles: ${baseFileName}.xml, ${baseFileName}.pdf`);
      } else if (results.length > 0 && errors.length > 0) {
        alert(`Partially saved:\n\n✓ ${results.join('\n✓ ')}\n\n✗ Errors:\n${errors.join('\n')}`);
      } else {
        throw new Error(errors.join('\n'));
      }
    } catch (error) {
      console.error('Save to cloud error:', error);
      alert(`Error saving to cloud: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSavingToDropbox(false);
    }
  };

  // Generate a simplified PDF for Dropbox save
  const generateProjectPDF = async (): Promise<Blob> => {
    // Create PDF - 11x17 Tabloid Landscape
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [279.4, 431.8]
    });

    const pageWidth = 431.8;
    const margin = 15;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 20, 25);
    doc.text(metadata?.name || 'Project Schedule', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Start: ${metadata?.start_date || 'N/A'} | Status: ${metadata?.status_date || 'N/A'} | Tasks: ${tasks.length} | Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
      pageWidth / 2, 28, { align: 'center' }
    );

    // Parse duration helper
    const parseDuration = (duration: string): number => {
      const match = duration.match(/PT(\d+)H/);
      if (match) return parseInt(match[1]) / 8;
      return 0;
    };

    // Calculate task dates
    const taskMap = new Map(tasks.map(t => [t.outline_number, t]));
    const taskDates = new Map<string, { start: Date; finish: Date }>();
    const startDate = metadata?.start_date ? parseISO(metadata.start_date) : new Date();

    const calculateDate = (task: Task): { start: Date; finish: Date } => {
      if (taskDates.has(task.outline_number)) {
        return taskDates.get(task.outline_number)!;
      }

      let taskStart = startDate;

      if (task.predecessors && task.predecessors.length > 0) {
        for (const pred of task.predecessors) {
          const predTask = taskMap.get(pred.outline_number);
          if (predTask) {
            const predDates = calculateDate(predTask);
            const lagDays = (pred.lag || 0) / 480;
            const predEnd = addDays(predDates.finish, lagDays);
            if (predEnd > taskStart) {
              taskStart = predEnd;
            }
          }
        }
      }

      const duration = parseDuration(task.duration);
      const taskFinish = addDays(taskStart, duration);

      const dates = { start: taskStart, finish: taskFinish };
      taskDates.set(task.outline_number, dates);
      return dates;
    };

    tasks.forEach(task => calculateDate(task));

    // Table data
    const tableData = tasks.map((task, index) => {
      const dates = taskDates.get(task.outline_number);
      return [
        (index + 1).toString(),
        task.outline_number,
        task.name,
        `${parseDuration(task.duration)} days`,
        dates ? format(dates.start, 'MM/dd/yy') : '-',
        dates ? format(dates.finish, 'MM/dd/yy') : '-',
        `${task.percent_complete}%`
      ];
    });

    // Generate table
    autoTable(doc, {
      startY: 35,
      head: [['#', 'WBS', 'Task Name', 'Duration', 'Start', 'Finish', '%']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 20, 25],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [50, 50, 50]
      },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 20 },
        2: { cellWidth: 80 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { cellWidth: 15 }
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        // Footer on each page
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageWidth / 2,
          279.4 - 10,
          { align: 'center' }
        );
      }
    });

    // Return as Blob
    return doc.output('blob');
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
    const computing = new Set<string>(); // Track tasks being computed to detect circular deps
    const startDate = parseISO(metadata.start_date);

    // Calculate start dates for all tasks (considering predecessors)
    const calculateStartDate = (task: Task): Date => {
      if (taskDates.has(task.id)) {
        return taskDates.get(task.id)!;
      }

      // Detect circular dependency - if we're already computing this task, break the cycle
      if (computing.has(task.id)) {
        console.warn(`Circular dependency detected for task: ${task.name} (${task.outline_number})`);
        return startDate; // Break cycle by returning project start date
      }

      computing.add(task.id);

      if (!task.predecessors || task.predecessors.length === 0) {
        taskDates.set(task.id, startDate);
        computing.delete(task.id);
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
      computing.delete(task.id);
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Modern Dark Header */}
      <header style={{ padding: '16px 24px' }} className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
        <div className="flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-5">
            <Link to="/app" className="flex items-center gap-5 hover:opacity-80 transition-opacity" title="Go to Home">
              <img src="/sturgis-logo.png" alt="Sturgis Logo" className="h-10 w-auto object-contain" style={{ filter: 'brightness(1.1)' }} />
              <div className="h-8 w-px bg-slate-600"></div>
              <span className="text-base font-semibold text-white tracking-tight">
                Sturgis Project
              </span>
            </Link>
          </div>
          
          {/* Navigation Actions */}
          <nav className="flex items-center gap-2">
              <button
                onClick={() => setIsProjectManagerOpen(true)}
                title="Manage Projects"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <FolderOpen className="h-4 w-4" />
                Projects
              </button>

              <label className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer">
                <Upload className="h-4 w-4" />
                Upload XML
                <input type="file" accept=".xml" onChange={handleFileUpload} hidden />
              </label>

              <button
                onClick={handleCreateTask}
                disabled={!metadata}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                New Task
              </button>

              <button
                onClick={handleValidate}
                disabled={!metadata}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle className="h-4 w-4" />
                Validate
              </button>

              <ExportMenu
                tasks={tasks}
                metadata={metadata}
                onExportXML={handleExport}
              />

              <button
                onClick={() => setIsChatOpen(true)}
                title="AI Assistant"
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all shadow-md"
              >
                <MessageCircle className="h-4 w-4" />
                AI Chat
              </button>

              <button
                onClick={() => setIsHowToUseOpen(true)}
                title="How to Use"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <HelpCircle className="h-4 w-4" />
                Help
              </button>

              {/* User Menu */}
              <div className="relative ml-2 pl-2 border-l border-slate-600">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <span className="max-w-[120px] truncate text-white">{user?.name || 'User'}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-300 transition-transform flex-shrink-0 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0"
                      style={{ zIndex: 9998 }}
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div 
                      className="absolute right-0 mt-2 w-56 rounded-xl shadow-xl overflow-hidden"
                      style={{ 
                        zIndex: 9999,
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', backgroundColor: 'white' }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</p>
                        <p style={{ fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
                      </div>
                      <div style={{ padding: '4px 0', backgroundColor: 'white' }}>
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            logout();
                            window.location.href = '/';
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            fontSize: '14px',
                            color: '#dc2626',
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </nav>
          </div>
      </header>

      {/* Project Info Bar */}
      {metadata && (
        <div style={{ padding: '16px 24px' }} className="bg-white border-b border-slate-200 shadow-sm">
          <div className="flex items-center justify-between gap-8">
            {/* Project Title & Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">{metadata.name}</h2>
              <p className="text-sm text-slate-500 mt-1.5 font-medium flex items-center flex-wrap gap-x-3">
                <span>Start: <span className="text-slate-700 font-mono text-xs">{metadata.start_date}</span></span>
                <span className="text-slate-300">|</span>
                <span>Status: <span className="text-slate-700 font-mono text-xs">{metadata.status_date}</span></span>
                {projectDuration && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span>Duration: <span className="text-slate-900 font-semibold">{projectDuration.days} days</span></span>
                    <span className="text-slate-400 text-xs">(End: {projectDuration.endDate})</span>
                  </>
                )}
              </p>
            </div>
            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setIsBaselineManagerOpen(true)}
                title="Baseline Manager"
                style={{ padding: '10px' }}
                className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 hover:border-slate-300 transition-all"
              >
                <GitBranch className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsCalendarOpen(true)}
                title="Calendar Settings"
                style={{ padding: '10px' }}
                className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 hover:border-slate-300 transition-all"
              >
                <Calendar className="h-4 w-4" />
              </button>
              {/* Recalculate Dates Button */}
              <button
                onClick={handleRecalculateDates}
                disabled={isRecalculating}
                title="Recalculate Dates (based on dependencies)"
                style={{ padding: '10px' }}
                className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 rounded-lg border border-orange-200 hover:border-orange-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRecalculating ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
              {/* Manual Save Button - always visible, prominent when unsaved changes exist */}
              <button
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
                title={hasUnsavedChanges ? "Save Project (Unsaved Changes)" : "All Changes Saved"}
                style={{ padding: '10px' }}
                className={`flex items-center rounded-lg border transition-all disabled:cursor-not-allowed ${
                  hasUnsavedChanges
                    ? 'text-white bg-green-500 hover:bg-green-600 border-green-600 animate-pulse'
                    : 'text-slate-500 bg-slate-100 border-slate-300 hover:bg-slate-200'
                }`}
              >
                {isSaving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={handleSaveToCloud}
                disabled={isSavingToDropbox}
                title="Backup to Cloud"
                style={{ padding: '10px' }}
                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 hover:border-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingToDropbox ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                ) : (
                  <Cloud className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => {
                  setSettingsInitialTab('project');
                  setIsMetadataOpen(true);
                }}
                title="Project Settings"
                style={{ padding: '10px' }}
                className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 hover:border-slate-300 transition-all"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {(validationErrors.length > 0 || validationWarnings.length > 0) && (
        <div className="container mx-auto px-6 py-4">
          <div className="space-y-4">
            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Validation Errors ({validationErrors.length})</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1">
                    {validationErrors.map((error, index) => {
                      const task = error.task_id ? tasks.find(t => t.id === error.task_id) : null;
                      const taskRef = task ? `#${tasks.indexOf(task) + 1} WBS ${task.outline_number}` : null;
                      return (
                        <li key={index}>
                          <strong>{error.field}:</strong> {error.message}
                          {taskRef && <span className="text-red-400 font-medium"> (Task {taskRef}: {task?.name})</span>}
                        </li>
                      );
                    })}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {validationWarnings.length > 0 && (
              <Alert variant="warning">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Validation Warnings ({validationWarnings.length})</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1">
                    {validationWarnings.map((warning, index) => {
                      const task = warning.task_id ? tasks.find(t => t.id === warning.task_id) : null;
                      const taskRef = task ? `#${tasks.indexOf(task) + 1} WBS ${task.outline_number}` : null;
                      return (
                        <li key={index}>
                          <strong>{warning.field}:</strong> {warning.message}
                          {taskRef && <span className="text-amber-600 font-medium"> (Task {taskRef}: {task?.name})</span>}
                        </li>
                      );
                    })}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 bg-slate-50">
        {tasksLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading tasks...</p>
            </div>
          </div>
        )}

        {!metadata && !tasksLoading && (
          <div className="flex items-center justify-center h-64">
            <Card className="max-w-md mx-auto">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                </div>
                <CardTitle>No Project Loaded</CardTitle>
                <CardDescription>
                  Upload an MS Project XML file to get started
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button asChild className="w-full">
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload XML File
                    <input type="file" accept=".xml" onChange={handleFileUpload} hidden />
                  </label>
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {metadata && tasks.length > 0 && (
          <GanttChart
            tasks={tasks}
            projectStartDate={metadata.start_date}
            onTaskClick={handleEditTask}
            onTaskEdit={handleEditTask}
            onTasksChanged={handleProjectChanged}
            onQuickAddTask={handleQuickAddTask}
            onDeleteTask={handleDeleteTaskFromMenu}
          />
        )}

        {metadata && tasks.length === 0 && !tasksLoading && (
          <div className="flex items-center justify-center h-64">
            <Card className="max-w-md mx-auto">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                  <Plus className="h-10 w-10 text-muted-foreground" />
                </div>
                <CardTitle>No Tasks</CardTitle>
                <CardDescription>
                  Create your first task to get started
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button onClick={handleCreateTask} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <TaskEditor
        task={selectedTask}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setSelectedTask(undefined);
          setQuickAddContext(null);
        }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        existingTasks={tasks}
        quickAddContext={quickAddContext}
      />

      <ProjectMetadataEditor
        metadata={metadata}
        isOpen={isMetadataOpen}
        onClose={() => setIsMetadataOpen(false)}
        onSave={async (updatedMetadata) => {
          await updateMetadataMutation.mutateAsync(updatedMetadata);
        }}
        initialTab={settingsInitialTab}
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

      {/* Delete Summary Task Confirmation Dialog */}
      {deleteConfirmDialog.isOpen && deleteConfirmDialog.task && (() => {
        const taskIndex = tasks.findIndex(t => t.id === deleteConfirmDialog.task?.id);
        const taskNum = taskIndex >= 0 ? taskIndex + 1 : '?';
        const taskWbs = deleteConfirmDialog.task.outline_number;
        return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Delete Summary Task</h3>
                  <p className="text-slate-400 text-sm">Task #{taskNum} • WBS {taskWbs}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Task Info Card */}
              <div className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-200">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FolderOpen className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{deleteConfirmDialog.task.name}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Contains <span className="font-bold text-red-600">{deleteConfirmDialog.childrenCount}</span> child task{deleteConfirmDialog.childrenCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-slate-600 mb-5 text-sm font-medium">Choose an action:</p>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => handleConfirmDelete('ungroup')}
                  className="w-full px-5 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-2 border-blue-200 hover:border-blue-400 rounded-xl text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 group-hover:bg-blue-200 flex items-center justify-center transition-colors">
                      <ChevronDown className="h-5 w-5 text-blue-600 rotate-180" />
                    </div>
                    <div>
                      <div className="font-bold text-blue-800">Ungroup (Keep Children)</div>
                      <div className="text-sm text-blue-600">Promote {deleteConfirmDialog.childrenCount} children up one level</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleConfirmDelete('delete-all')}
                  className="w-full px-5 py-4 bg-gradient-to-r from-red-50 to-orange-50 hover:from-red-100 hover:to-orange-100 border-2 border-red-200 hover:border-red-400 rounded-xl text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-100 group-hover:bg-red-200 flex items-center justify-center transition-colors">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <div className="font-bold text-red-800">Delete All ({deleteConfirmDialog.childrenCount + 1} tasks)</div>
                      <div className="text-sm text-red-600">Permanently remove summary and all children</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setDeleteConfirmDialog({ isOpen: false, task: null, childrenCount: 0 })}
                  className="w-full px-4 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-slate-700 font-semibold transition-all mt-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

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
