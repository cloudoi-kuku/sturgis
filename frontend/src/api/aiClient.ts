/**
 * AI Client for local LLM features
 * Communicates with Ollama-powered backend
 */

const API_BASE = 'http://localhost:8000/api';

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

