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
import { DropboxSettings, uploadToDropbox, isDropboxConnected } from './components/DropboxSettings';
import { Button } from './components/ui/button';
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
import { Upload, Plus, CheckCircle, AlertCircle, Settings, MessageCircle, FolderOpen, Calendar, GitBranch, HelpCircle, Save, Cloud } from 'lucide-react';
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
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isBaselineManagerOpen, setIsBaselineManagerOpen] = useState(false);
  const [isHowToUseOpen, setIsHowToUseOpen] = useState(false);
  const [isDropboxSettingsOpen, setIsDropboxSettingsOpen] = useState(false);
  const [isSavingToDropbox, setIsSavingToDropbox] = useState(false);
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

  // Save to Dropbox (XML + PDF)
  const handleSaveToDropbox = async () => {
    if (!metadata) {
      alert('No project loaded');
      return;
    }

    if (!isDropboxConnected()) {
      const connect = confirm('Dropbox is not connected. Would you like to configure Dropbox settings?');
      if (connect) {
        setIsDropboxSettingsOpen(true);
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

      // 2. Generate PDF (simplified version for Dropbox save)
      const pdfBlob = await generateProjectPDF();

      // 3. Upload XML to Dropbox
      const xmlResult = await uploadToDropbox(
        `${baseFileName}.xml`,
        xmlBlob,
        'application/xml'
      );

      if (!xmlResult.success) {
        throw new Error(`XML upload failed: ${xmlResult.error}`);
      }

      // 4. Upload PDF to Dropbox
      const pdfResult = await uploadToDropbox(
        `${baseFileName}.pdf`,
        pdfBlob,
        'application/pdf'
      );

      if (!pdfResult.success) {
        throw new Error(`PDF upload failed: ${pdfResult.error}`);
      }

      alert(`Successfully saved to Dropbox!\n\n• ${baseFileName}.xml\n• ${baseFileName}.pdf`);
    } catch (error) {
      console.error('Save to Dropbox error:', error);
      alert(`Error saving to Dropbox: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Modern Dark Header */}
      <header style={{ padding: '16px 24px' }} className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
        <div className="flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-5">
            <img src="/sturgis-logo.png" alt="Sturgis Logo" className="h-10 w-auto object-contain" style={{ filter: 'brightness(1.1)' }} />
            <div className="h-8 w-px bg-slate-600"></div>
            <span className="text-base font-semibold text-white tracking-tight">
              Sturgis Project
            </span>
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
              <button
                onClick={handleSaveToDropbox}
                disabled={isSavingToDropbox}
                title="Save to Dropbox"
                style={{ padding: '10px' }}
                className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 hover:border-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingToDropbox ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => setIsDropboxSettingsOpen(true)}
                title="Dropbox Settings"
                style={{ padding: '10px' }}
                className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 hover:border-slate-300 transition-all"
              >
                <Cloud className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsMetadataOpen(true)}
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
                    {validationErrors.map((error, index) => (
                      <li key={index}>
                        <strong>{error.field}:</strong> {error.message}
                        {error.task_id && <span className="text-muted-foreground"> (Task: {error.task_id})</span>}
                      </li>
                    ))}
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
                    {validationWarnings.map((warning, index) => (
                      <li key={index}>
                        <strong>{warning.field}:</strong> {warning.message}
                        {warning.task_id && <span className="text-muted-foreground"> (Task: {warning.task_id})</span>}
                      </li>
                    ))}
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

      <DropboxSettings
        isOpen={isDropboxSettingsOpen}
        onClose={() => setIsDropboxSettingsOpen(false)}
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
