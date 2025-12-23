import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
  name: string;
  start_date: string;
  status_date: string;
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

// API Functions
export const uploadProject = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post('/api/project/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
};

export const getProjectMetadata = async (): Promise<ProjectMetadata> => {
  const response = await apiClient.get('/api/project/metadata');
  return response.data;
};

export const updateProjectMetadata = async (metadata: ProjectMetadata) => {
  const response = await apiClient.put('/api/project/metadata', metadata);
  return response.data;
};

export const getTasks = async (): Promise<{ tasks: Task[] }> => {
  const response = await apiClient.get('/api/tasks');
  return response.data;
};

export const createTask = async (task: TaskCreate): Promise<{ success: boolean; task: Task }> => {
  const response = await apiClient.post('/api/tasks', task);
  return response.data;
};

export const updateTask = async (taskId: string, updates: TaskUpdate) => {
  const response = await apiClient.put(`/api/tasks/${taskId}`, updates);
  return response.data;
};

export const deleteTask = async (taskId: string) => {
  const response = await apiClient.delete(`/api/tasks/${taskId}`);
  return response.data;
};

export const validateProject = async (): Promise<ValidationResult> => {
  const response = await apiClient.post('/api/validate');
  return response.data;
};

export const exportProject = async (): Promise<Blob> => {
  const response = await apiClient.post('/api/export', null, {
    responseType: 'blob',
  });
  return response.data;
};

