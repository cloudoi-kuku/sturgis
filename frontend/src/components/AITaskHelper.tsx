import React, { useState } from 'react';
import { estimateTaskDuration, categorizeTask, type DurationEstimate, type TaskCategory } from '../api/aiClient';
import { Sparkles, Loader2 } from 'lucide-react';
import './AITaskHelper.css';

interface AITaskHelperProps {
  taskName: string;
  taskType?: string;
  onDurationSuggest: (days: number) => void;
  onCategorySuggest?: (category: string) => void;
}

export const AITaskHelper: React.FC<AITaskHelperProps> = ({
  taskName,
  taskType,
  onDurationSuggest,
  onCategorySuggest
}) => {
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimate, setEstimate] = useState<DurationEstimate | null>(null);
  const [category, setCategory] = useState<TaskCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEstimateDuration = async () => {
    if (!taskName.trim()) {
      setError('Please enter a task name first');
      return;
    }

    setIsEstimating(true);
    setError(null);

    try {
      const result = await estimateTaskDuration(taskName, taskType);
      setEstimate(result);
      
      // Also get category suggestion
      const catResult = await categorizeTask(taskName);
      setCategory(catResult);
    } catch (err) {
      setError('AI service unavailable. Make sure Ollama is running.');
      console.error('AI estimation error:', err);
    } finally {
      setIsEstimating(false);
    }
  };

  const handleApplyDuration = () => {
    if (estimate) {
      onDurationSuggest(estimate.days);
    }
  };

  const handleApplyCategory = () => {
    if (category && onCategorySuggest) {
      onCategorySuggest(category.category);
    }
  };

  return (
    <div className="ai-task-helper">
      <button
        className="ai-suggest-button"
        onClick={handleEstimateDuration}
        disabled={isEstimating || !taskName.trim()}
        title="Get AI suggestions for this task"
      >
        {isEstimating ? (
          <>
            <Loader2 size={16} className="spinning" />
            Analyzing...
          </>
        ) : (
          <>
            <Sparkles size={16} />
            AI Suggest
          </>
        )}
      </button>

      {error && (
        <div className="ai-error">
          ⚠️ {error}
        </div>
      )}

      {estimate && (
        <div className="ai-suggestions">
          <div className="ai-suggestion-card">
            <div className="suggestion-header">
              <span className="suggestion-label">📊 Duration Estimate</span>
              <span className={`confidence-badge confidence-${getConfidenceLevel(estimate.confidence)}`}>
                {estimate.confidence}% confident
              </span>
            </div>
            <div className="suggestion-value">
              <strong>{estimate.days}</strong> {estimate.days === 1 ? 'day' : 'days'}
            </div>
            <div className="suggestion-reasoning">
              {estimate.reasoning}
            </div>
            <button className="apply-button" onClick={handleApplyDuration}>
              ✓ Apply Duration
            </button>
          </div>

          {category && (
            <div className="ai-suggestion-card">
              <div className="suggestion-header">
                <span className="suggestion-label">🏷️ Category</span>
                <span className={`confidence-badge confidence-${getConfidenceLevel(category.confidence)}`}>
                  {category.confidence}% confident
                </span>
              </div>
              <div className="suggestion-value">
                <span className="category-tag" style={{ 
                  borderLeft: `4px solid ${getCategoryColor(category.category)}` 
                }}>
                  {getCategoryIcon(category.category)} {category.category}
                </span>
              </div>
              {onCategorySuggest && (
                <button className="apply-button" onClick={handleApplyCategory}>
                  ✓ Apply Category
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 80) return 'high';
  if (confidence >= 60) return 'medium';
  return 'low';
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    site_work: '#8B4513',
    foundation: '#696969',
    structural: '#FF8C00',
    exterior: '#4169E1',
    mechanical: '#DC143C',
    interior: '#9370DB',
    finishing: '#FFD700',
    inspection: '#32CD32',
    landscaping: '#228B22',
    specialty: '#FF1493'
  };
  return colors[category] || '#34495e';
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    site_work: '🚜',
    foundation: '🏗️',
    structural: '�',
    exterior: '🏠',
    mechanical: '⚡',
    interior: '🚪',
    finishing: '🎨',
    inspection: '✅',
    landscaping: '🌳',
    specialty: '⭐'
  };
  return icons[category] || '📌';
}

