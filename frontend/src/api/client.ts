import axios from 'axios';

// Get API base URL from environment
// In Docker: VITE_API_URL=/api (relative, uses nginx proxy)
// In dev: VITE_API_URL=http://localhost:8000/api (full URL to backend)
const envApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Ensure the base URL ends with /api
const API_BASE_URL = envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl}/api`;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export type Predecessor = {
  outline_number: string;
  type: number;
  lag: number;
  lag_format: number;
}

// MS Project Baseline - captures schedule snapshot
export type TaskBaseline = {
  number: number;  // 0-10 (MS Project supports 11 baselines)
  start?: string;  // Baseline start date
  finish?: string;  // Baseline finish date
  duration?: string;  // Baseline duration (ISO 8601)
  duration_format?: number;
  work?: string;
  cost?: number;
  bcws?: number;  // Budgeted Cost of Work Scheduled
  bcwp?: number;  // Budgeted Cost of Work Performed
  fixed_cost?: number;
  estimated_duration?: boolean;
  interim?: boolean;
}

export type Task = {
  id: string;
  uid: string;
  name: string;
  outline_number: string;
  outline_level: number;
  duration: string;
  milestone: boolean;
  summary: boolean;
  percent_complete: number;
  value: string;
  predecessors: Predecessor[];
  start_date?: string;
  finish_date?: string;
  // MS Project Baselines (up to 11: 0-10)
  baselines?: TaskBaseline[];
  // Critical Path Method fields (populated by /api/critical-path)
  early_start?: number;
  early_finish?: number;
  late_start?: number;
  late_finish?: number;
  total_float?: number;
  is_critical?: boolean;
}

export type TaskCreate = {
  name: string;
  outline_number: string;
  duration?: string;
  value?: string;
  milestone?: boolean;
  percent_complete?: number;
  predecessors?: Predecessor[];
}

export type TaskUpdate = {
  name?: string;
  outline_number?: string;
  duration?: string;
  value?: string;
  milestone?: boolean;
  percent_complete?: number;
  predecessors?: Predecessor[];
}

export type ProjectMetadata = {
  project_id?: string;
  name: string;
  start_date: string;
  status_date: string;
  task_count?: number;
}

export type ValidationError = {
  field: string;
  message: string;
  task_id?: string;
}

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export type CriticalPathResult = {
  critical_tasks: Task[];
  project_duration: number;
  task_floats: Record<string, number>;
  critical_task_ids: string[];
}

// Calendar Types
export type CalendarException = {
  id?: number;
  exception_date: string;  // YYYY-MM-DD format
  name: string;
  is_working: boolean;  // false = holiday, true = working day override
}

export type ProjectCalendar = {
  work_week: number[];  // 1=Monday, 7=Sunday
  hours_per_day: number;
  exceptions: CalendarException[];
}

// API Functions
export const uploadProject = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/project/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
};

export const getProjectMetadata = async (): Promise<ProjectMetadata> => {
  const response = await apiClient.get('/project/metadata');
  return response.data;
};

export const updateProjectMetadata = async (metadata: ProjectMetadata) => {
  const response = await apiClient.put('/project/metadata', metadata);
  return response.data;
};

export const getTasks = async (): Promise<{ tasks: Task[] }> => {
  const response = await apiClient.get('/tasks');
  return response.data;
};

export const createTask = async (task: TaskCreate): Promise<{ success: boolean; task: Task }> => {
  const response = await apiClient.post('/tasks', task);
  return response.data;
};

export const updateTask = async (taskId: string, updates: TaskUpdate) => {
  const response = await apiClient.put(`/tasks/${taskId}`, updates);
  return response.data;
};

export const deleteTask = async (taskId: string) => {
  const response = await apiClient.delete(`/tasks/${taskId}`);
  return response.data;
};

export const validateProject = async (): Promise<ValidationResult> => {
  const response = await apiClient.post('/validate');
  return response.data;
};

export const exportProject = async (): Promise<Blob> => {
  const response = await apiClient.post('/export', null, {
    responseType: 'blob',
  });
  return response.data;
};

export const getCriticalPath = async (): Promise<{
  critical_tasks: Task[];
  project_duration: number;
  task_floats: Record<string, number>;
  critical_task_ids: string[];
}> => {
  const response = await apiClient.get('/critical-path');
  return response.data;
};

// Project List Item Type
export type ProjectListItem = {
  id: string;
  name: string;
  task_count: number;
  start_date: string;
  is_active: boolean;
}

// Project Management Functions
export const getAllProjects = async (): Promise<{
  projects: ProjectListItem[];
}> => {
  const response = await apiClient.get('/projects');
  return response.data;
};

// AI Project Generation
export const generateProject = async (description: string, projectType: string): Promise<{
  success: boolean;
  message: string;
  project_id?: string;
  project_name?: string;
  task_count?: number;
}> => {
  const response = await apiClient.post('/ai/generate-project', {
    description,
    project_type: projectType
  });
  return response.data;
};

export const createNewProject = async (name: string = "New Project"): Promise<{
  success: boolean;
  message: string;
  project_id: string;
  project: any;
}> => {
  const response = await apiClient.post('/projects/new', null, {
    params: { name }
  });
  return response.data;
};

export const switchProject = async (projectId: string): Promise<{
  success: boolean;
  message: string;
  project_id: string;
  project: any;
}> => {
  const response = await apiClient.post(`/projects/${projectId}/switch`);
  return response.data;
};

export const deleteProject = async (projectId: string): Promise<{
  success: boolean;
  message: string;
}> => {
  const response = await apiClient.delete(`/projects/${projectId}`);
  return response.data;
};

// Calendar Management Functions
export const getCalendar = async (): Promise<ProjectCalendar> => {
  const response = await apiClient.get('/calendar');
  return response.data;
};

export const updateCalendar = async (calendar: ProjectCalendar): Promise<{
  success: boolean;
  message: string;
}> => {
  const response = await apiClient.put('/calendar', calendar);
  return response.data;
};

export const addCalendarException = async (exception: Omit<CalendarException, 'id'>): Promise<{
  success: boolean;
  message: string;
  id: number;
}> => {
  const response = await apiClient.post('/calendar/exceptions', exception);
  return response.data;
};

export const removeCalendarException = async (exceptionDate: string): Promise<{
  success: boolean;
  message: string;
}> => {
  const response = await apiClient.delete(`/calendar/exceptions/${exceptionDate}`);
  return response.data;
};

// ============================================================================
// BASELINE MANAGEMENT
// ============================================================================

export type BaselineInfo = {
  number: number;
  set_date: string;
  task_count: number;
};

export type ProjectBaselinesResponse = {
  baselines: BaselineInfo[];
  total_tasks: number;
};

export type SetBaselineRequest = {
  baseline_number: number;
  task_ids?: string[];
};

export type ClearBaselineRequest = {
  baseline_number: number;
  task_ids?: string[];
};

export type SetBaselineResponse = {
  success: boolean;
  message: string;
  baseline_number: number;
  tasks_baselined: number;
};

export type ClearBaselineResponse = {
  success: boolean;
  message: string;
  baseline_number: number;
  tasks_cleared: number;
};

export const getBaselines = async (): Promise<ProjectBaselinesResponse> => {
  const response = await apiClient.get('/baselines');
  return response.data;
};

export const setBaseline = async (
  baselineNumber: number,
  taskIds?: string[]
): Promise<SetBaselineResponse> => {
  const response = await apiClient.post('/baselines/set', {
    baseline_number: baselineNumber,
    task_ids: taskIds
  });
  return response.data;
};

export const clearBaseline = async (
  baselineNumber: number,
  taskIds?: string[]
): Promise<ClearBaselineResponse> => {
  const response = await apiClient.post('/baselines/clear', {
    baseline_number: baselineNumber,
    task_ids: taskIds
  });
  return response.data;
};
