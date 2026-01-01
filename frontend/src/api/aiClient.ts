/**
 * AI Client for local LLM features
 * Communicates with Ollama-powered backend
 */

// Get API base URL from environment
// In Docker: VITE_API_URL=/api (relative, uses nginx proxy)
// In dev: VITE_API_URL=http://localhost:8000/api (full URL to backend)
const envApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const API_BASE = envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl}/api`;

export interface DurationEstimate {
  days: number;
  confidence: number;
  reasoning: string;
}

export interface DependencySuggestion {
  task_id: string;
  depends_on_id: string;
  depends_on_name: string;
  confidence: number;
  reason: string;
}

export interface TaskCategory {
  category: 'site_work' | 'foundation' | 'structural' | 'exterior' | 'mechanical' | 'interior' | 'finishing' | 'inspection' | 'landscaping' | 'specialty';
  confidence: number;
}

export interface AIHealthStatus {
  status: 'healthy' | 'unavailable';
  model: string;
  provider: string;
}

/**
 * Check if AI service is available
 */
export async function checkAIHealth(): Promise<AIHealthStatus> {
  const response = await fetch(`${API_BASE}/ai/health`);
  if (!response.ok) {
    throw new Error('AI health check failed');
  }
  return response.json();
}

/**
 * Get AI-powered duration estimate for a task
 */
export async function estimateTaskDuration(
  taskName: string,
  taskType?: string
): Promise<DurationEstimate> {
  const response = await fetch(`${API_BASE}/ai/estimate-duration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_name: taskName,
      task_type: taskType || ''
    })
  });

  if (!response.ok) {
    throw new Error('Duration estimation failed');
  }

  return response.json();
}

/**
 * Detect logical dependencies between tasks
 */
export async function detectDependencies(
  tasks: Array<{ id: string; name: string }>
): Promise<DependencySuggestion[]> {
  const response = await fetch(`${API_BASE}/ai/detect-dependencies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks })
  });

  if (!response.ok) {
    throw new Error('Dependency detection failed');
  }

  const data = await response.json();
  return data.suggestions;
}

/**
 * Categorize a task by type
 */
export async function categorizeTask(taskName: string): Promise<TaskCategory> {
  const response = await fetch(`${API_BASE}/ai/categorize-task`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_name: taskName })
  });

  if (!response.ok) {
    throw new Error('Task categorization failed');
  }

  return response.json();
}

/**
 * Get category color for visual display (Construction-specific)
 */
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    site_work: '#8B4513',    // Brown - earth/dirt
    foundation: '#696969',   // Dark gray - concrete
    structural: '#FF8C00',   // Dark orange - wood/steel
    exterior: '#4169E1',     // Royal blue - sky/outside
    mechanical: '#DC143C',   // Crimson - pipes/wires
    interior: '#9370DB',     // Medium purple - indoor
    finishing: '#FFD700',    // Gold - final touches
    inspection: '#32CD32',   // Lime green - approval
    landscaping: '#228B22',  // Forest green - plants
    specialty: '#FF1493'     // Deep pink - unique
  };
  return colors[category] || '#34495e';
}

/**
 * Get category icon (Construction-specific)
 */
export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    site_work: '🚜',      // Excavator
    foundation: '🏗️',     // Construction
    structural: '🔨',     // Hammer
    exterior: '🏠',       // House
    mechanical: '⚡',     // Electrical/mechanical
    interior: '🚪',       // Door
    finishing: '🎨',      // Paint
    inspection: '✅',     // Checkmark
    landscaping: '🌳',    // Tree
    specialty: '⭐'       // Star
  };
  return icons[category] || '📌';
}

// ============================================================================
// AI PROJECT EDITOR TYPES & FUNCTIONS
// ============================================================================

export interface AIEditChange {
  type: string;
  task_name?: string;
  old_outline?: string;
  new_outline?: string;
  description: string;
}

export interface AIEditResult {
  success: boolean;
  message: string;
  command_type?: string;
  changes: AIEditChange[];
  tasks_affected: number;
}

export interface AISuggestion {
  id: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  command: string;
  affected_tasks: string[];
  estimated_improvement: string;
}

export interface AISuggestionsResult {
  success: boolean;
  suggestions: AISuggestion[];
  project_analyzed: string;
  total_tasks: number;
}

export interface LearnedTemplate {
  project_type: string;
  common_phases: string[];
  common_tasks: Array<{ name: string; frequency: number; avg_duration_hours: number }>;
  common_milestones: string[];
  duration_norms: Record<string, { avg_hours: number; sample_count: number }>;
  projects_analyzed: number;
}

/**
 * Execute an AI project editing command
 * Supports: move, insert, delete, merge, split, sequence, reorganize
 */
export async function executeAIEditCommand(
  command: string,
  projectId?: string
): Promise<AIEditResult> {
  const response = await fetch(`${API_BASE}/ai/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command,
      project_id: projectId
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'AI edit command failed');
  }

  return response.json();
}

/**
 * Get AI suggestions for improving project structure
 */
export async function getAISuggestions(
  suggestionType: 'all' | 'reorganize' | 'dependencies' | 'sequence' | 'phases' = 'all',
  projectId?: string
): Promise<AISuggestionsResult> {
  const response = await fetch(`${API_BASE}/ai/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      suggestion_type: suggestionType,
      project_id: projectId
    })
  });

  if (!response.ok) {
    throw new Error('AI suggestions failed');
  }

  return response.json();
}

/**
 * Apply a specific AI suggestion
 */
export async function applyAISuggestion(
  suggestionId: string,
  command: string,
  projectId?: string
): Promise<AIEditResult> {
  const response = await fetch(`${API_BASE}/ai/apply-suggestion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      suggestion_id: suggestionId,
      command,
      project_id: projectId
    })
  });

  if (!response.ok) {
    throw new Error('Apply suggestion failed');
  }

  return response.json();
}

/**
 * Learn patterns from existing projects
 */
export async function learnFromProjects(
  projectIds?: string[],
  maxProjects: number = 10
): Promise<LearnedTemplate> {
  const response = await fetch(`${API_BASE}/ai/learn-template`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_ids: projectIds,
      max_projects: maxProjects
    })
  });

  if (!response.ok) {
    throw new Error('Template learning failed');
  }

  return response.json();
}

/**
 * Auto-reorganize entire project
 */
export async function autoReorganizeProject(projectId?: string): Promise<AIEditResult> {
  const response = await fetch(`${API_BASE}/ai/auto-reorganize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId })
  });

  if (!response.ok) {
    throw new Error('Auto-reorganize failed');
  }

  return response.json();
}

/**
 * Generate project from learned templates
 */
export async function generateFromTemplate(
  description: string,
  projectType: string = 'commercial',
  useLearnedPatterns: boolean = true
): Promise<{
  success: boolean;
  project_id: string;
  project_name: string;
  task_count: number;
  learned_from: number;
  message: string;
}> {
  const response = await fetch(
    `${API_BASE}/ai/generate-from-template?description=${encodeURIComponent(description)}&project_type=${projectType}&use_learned_patterns=${useLearnedPatterns}`,
    { method: 'POST' }
  );

  if (!response.ok) {
    throw new Error('Template-based generation failed');
  }

  return response.json();
}

/**
 * Get priority badge color
 */
export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    high: '#ef4444',    // Red
    medium: '#f59e0b',  // Amber
    low: '#10b981'      // Green
  };
  return colors[priority] || '#6b7280';
}

/**
 * Get suggestion type icon
 */
export function getSuggestionIcon(type: string): string {
  const icons: Record<string, string> = {
    sequence: '🔄',
    dependency: '🔗',
    reorganize: '📊',
    merge: '🔀',
    split: '✂️',
    phase: '📁'
  };
  return icons[type] || '💡';
}

