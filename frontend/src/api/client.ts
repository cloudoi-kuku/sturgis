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

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (token expired)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ==================== AUTH API ====================

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  company?: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
  company?: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export const authApi = {
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  getMe: async (): Promise<AuthUser> => {
    const response = await apiClient.get<AuthUser>('/auth/me');
    return response.data;
  },

  verifyToken: async (): Promise<{ valid: boolean; user: AuthUser }> => {
    const response = await apiClient.post<{ valid: boolean; user: AuthUser }>('/auth/verify');
    return response.data;
  },
};

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

// MS Project compatible constraint types
export const ConstraintType = {
  AS_SOON_AS_POSSIBLE: 0,      // Default - schedule task as early as possible
  AS_LATE_AS_POSSIBLE: 1,      // Schedule task as late as possible
  MUST_START_ON: 2,            // Task must start on the constraint date
  MUST_FINISH_ON: 3,           // Task must finish on the constraint date
  START_NO_EARLIER_THAN: 4,    // Task cannot start before the constraint date
  START_NO_LATER_THAN: 5,      // Task must start by the constraint date
  FINISH_NO_EARLIER_THAN: 6,   // Task cannot finish before the constraint date
  FINISH_NO_LATER_THAN: 7,     // Task must finish by the constraint date
} as const;

export type ConstraintTypeValue = typeof ConstraintType[keyof typeof ConstraintType];

export const CONSTRAINT_TYPE_LABELS: Record<number, string> = {
  [ConstraintType.AS_SOON_AS_POSSIBLE]: 'As Soon As Possible',
  [ConstraintType.AS_LATE_AS_POSSIBLE]: 'As Late As Possible',
  [ConstraintType.MUST_START_ON]: 'Must Start On',
  [ConstraintType.MUST_FINISH_ON]: 'Must Finish On',
  [ConstraintType.START_NO_EARLIER_THAN]: 'Start No Earlier Than',
  [ConstraintType.START_NO_LATER_THAN]: 'Start No Later Than',
  [ConstraintType.FINISH_NO_EARLIER_THAN]: 'Finish No Earlier Than',
  [ConstraintType.FINISH_NO_LATER_THAN]: 'Finish No Later Than',
};

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
  // MS Project Task Constraints
  constraint_type?: number;  // 0-7 (see ConstraintType enum)
  constraint_date?: string;  // ISO 8601 date (required for types 2-7)
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
  constraint_type?: number;  // 0-7 (see ConstraintType enum)
  constraint_date?: string;  // ISO 8601 date (required for types 2-7)
}

export type TaskUpdate = {
  name?: string;
  outline_number?: string;
  duration?: string;
  value?: string;
  milestone?: boolean;
  percent_complete?: number;
  predecessors?: Predecessor[];
  constraint_type?: number;  // 0-7 (see ConstraintType enum)
  constraint_date?: string;  // ISO 8601 date (required for types 2-7)
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

// Manual Save - persists all in-memory changes to database
export type SaveProjectResponse = {
  success: boolean;
  message: string;
  task_count: number;
};

export const saveProject = async (): Promise<SaveProjectResponse> => {
  const response = await apiClient.post('/project/save');
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

// Ungroup a summary task (remove it but keep children)
export const ungroupTask = async (taskId: string): Promise<{
  success: boolean;
  message: string;
  changes: Array<{ type: string; task_name: string; old_outline?: string; new_outline?: string }>;
}> => {
  const response = await apiClient.post(`/tasks/${taskId}/ungroup`);
  return response.data;
};

// Get children count for a task (for delete warning)
export type TaskChildrenCount = {
  task_id: string;
  task_name: string;
  is_summary: boolean;
  children_count: number;
  direct_children_count: number;
};

export const getTaskChildrenCount = async (taskId: string): Promise<TaskChildrenCount> => {
  const response = await apiClient.get(`/tasks/${taskId}/children-count`);
  return response.data;
};

// Move task types
export type MovePosition = 'under' | 'before' | 'after';

export type MoveTaskChange = {
  type: string;
  task_name: string;
  old_outline: string;
  new_outline: string;
  description: string;
};

export type MoveTaskResponse = {
  success: boolean;
  message: string;
  changes: MoveTaskChange[];
  tasks_affected: number;
};

export const moveTask = async (
  taskId: string,
  targetOutline: string,
  position: MovePosition
): Promise<MoveTaskResponse> => {
  const response = await apiClient.post(`/tasks/${taskId}/move`, {
    target_outline: targetOutline,
    position: position
  });
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
  is_shared?: boolean;
  is_owned?: boolean | null;  // null = legacy project with no owner
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

export const updateProjectSharing = async (projectId: string, isShared: boolean): Promise<{
  success: boolean;
  message: string;
  is_shared: boolean;
}> => {
  const response = await apiClient.put(`/projects/${projectId}/share`, null, {
    params: { is_shared: isShared }
  });
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
