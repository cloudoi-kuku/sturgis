import React, { useState, useEffect } from 'react';
import {
  Wand2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Loader,
  AlertTriangle,
  Lightbulb,
  Command,
  Zap,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import {
  executeAIEditCommand,
  getAISuggestions,
  applyAISuggestion,
  learnFromProjects,
  autoReorganizeProject,
  AISuggestion,
  LearnedTemplate,
  AIEditResult,
  getPriorityColor,
  getSuggestionIcon
} from '../api/aiClient';
import './AIProjectEditor.css';

interface AIProjectEditorProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string | null;
  onProjectUpdated?: () => void;
}

type TabType = 'commands' | 'suggestions' | 'learn';

export const AIProjectEditor: React.FC<AIProjectEditorProps> = ({
  isOpen,
  onClose,
  projectId,
  onProjectUpdated
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('commands');
  const [command, setCommand] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<AIEditResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // Learning state
  const [learnedTemplate, setLearnedTemplate] = useState<LearnedTemplate | null>(null);
  const [isLearning, setIsLearning] = useState(false);

  // Example commands
  const exampleCommands = [
    { label: 'Move task', example: 'move task 1.3 under phase 2' },
    { label: 'Insert task', example: "insert task 'Electrical rough-in' after 2.3" },
    { label: 'Delete task', example: 'delete task 1.4' },
    { label: 'Merge tasks', example: 'merge tasks 1.2 and 1.3' },
    { label: 'Split task', example: 'split task 1.2 into 3 parts' },
    { label: 'Reorganize phase', example: 'reorganize phase 2' },
    { label: 'Update dependencies', example: 'update all dependencies' },
    { label: 'Create phase', example: "create phase 'Interior Work' after 2" },
    { label: 'Set duration', example: 'set task 1.2 duration to 10 days' },
    { label: 'Add buffer', example: 'add 15% buffer to all tasks' },
  ];

  // Load suggestions when tab changes
  useEffect(() => {
    if (activeTab === 'suggestions' && suggestions.length === 0) {
      loadSuggestions();
    }
  }, [activeTab]);

  const executeCommand = async () => {
    if (!command.trim()) return;

    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const response = await executeAIEditCommand(command, projectId || undefined);
      setResult(response);

      if (response.success) {
        setCommand('');
        // Notify parent of update
        if (onProjectUpdated) {
          onProjectUpdated();
        }
        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('projectUpdated'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Command execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const loadSuggestions = async () => {
    setIsLoadingSuggestions(true);
    setError(null);

    try {
      const response = await getAISuggestions('all', projectId || undefined);
      setSuggestions(response.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions');
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleApplySuggestion = async (suggestion: AISuggestion) => {
    setApplyingId(suggestion.id);
    setError(null);

    try {
      const response = await applyAISuggestion(
        suggestion.id,
        suggestion.command,
        projectId || undefined
      );

      if (response.success) {
        // Remove applied suggestion from list
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        // Notify parent
        if (onProjectUpdated) {
          onProjectUpdated();
        }
        window.dispatchEvent(new CustomEvent('projectUpdated'));
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply suggestion');
    } finally {
      setApplyingId(null);
    }
  };

  const handleAutoReorganize = async () => {
    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const response = await autoReorganizeProject(projectId || undefined);
      setResult(response);

      if (response.success && onProjectUpdated) {
        onProjectUpdated();
        window.dispatchEvent(new CustomEvent('projectUpdated'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto-reorganize failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleLearnPatterns = async () => {
    setIsLearning(true);
    setError(null);

    try {
      const template = await learnFromProjects(undefined, 10);
      setLearnedTemplate(template);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to learn patterns');
    } finally {
      setIsLearning(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ai-editor-overlay">
      <div className="ai-editor-container">
        {/* Header */}
        <div className="ai-editor-header">
          <div className="ai-editor-title">
            <Wand2 size={24} />
            <h2>AI Project Editor</h2>
          </div>
          <button className="ai-editor-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="ai-editor-tabs">
          <button
            className={`ai-editor-tab ${activeTab === 'commands' ? 'active' : ''}`}
            onClick={() => setActiveTab('commands')}
          >
            <Command size={16} />
            Commands
          </button>
          <button
            className={`ai-editor-tab ${activeTab === 'suggestions' ? 'active' : ''}`}
            onClick={() => setActiveTab('suggestions')}
          >
            <Lightbulb size={16} />
            Suggestions
            {suggestions.length > 0 && (
              <span className="ai-editor-badge">{suggestions.length}</span>
            )}
          </button>
          <button
            className={`ai-editor-tab ${activeTab === 'learn' ? 'active' : ''}`}
            onClick={() => setActiveTab('learn')}
          >
            <BookOpen size={16} />
            Learn
          </button>
        </div>

        {/* Content */}
        <div className="ai-editor-content">
          {/* Commands Tab */}
          {activeTab === 'commands' && (
            <div className="ai-editor-commands">
              <div className="ai-editor-section">
                <h3>Execute Command</h3>
                <p className="ai-editor-help">
                  Use natural language to modify your project. Type a command or click an example below.
                </p>

                <div className="ai-editor-input-group">
                  <textarea
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="e.g., move task 1.3 under phase 2"
                    rows={2}
                    disabled={isExecuting}
                  />
                  <button
                    className="ai-editor-execute-btn"
                    onClick={executeCommand}
                    disabled={!command.trim() || isExecuting}
                  >
                    {isExecuting ? (
                      <Loader className="ai-editor-spinner" size={18} />
                    ) : (
                      <>
                        <Zap size={18} />
                        Execute
                      </>
                    )}
                  </button>
                </div>

                {/* Quick actions */}
                <div className="ai-editor-quick-actions">
                  <button
                    className="ai-editor-quick-btn"
                    onClick={handleAutoReorganize}
                    disabled={isExecuting}
                  >
                    <RefreshCw size={16} />
                    Auto-Reorganize Project
                  </button>
                </div>

                {/* Result/Error display */}
                {result && (
                  <div className={`ai-editor-result ${result.success ? 'success' : 'error'}`}>
                    <div className="ai-editor-result-icon">
                      {result.success ? <Check size={20} /> : <AlertTriangle size={20} />}
                    </div>
                    <div className="ai-editor-result-content">
                      <strong>{result.success ? 'Success!' : 'Failed'}</strong>
                      <p>{result.message}</p>
                      {result.tasks_affected > 0 && (
                        <span className="ai-editor-affected">
                          {result.tasks_affected} task{result.tasks_affected > 1 ? 's' : ''} affected
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="ai-editor-result error">
                    <AlertTriangle size={20} />
                    <p>{error}</p>
                  </div>
                )}
              </div>

              {/* Example commands */}
              <div className="ai-editor-section">
                <h3>Example Commands</h3>
                <div className="ai-editor-examples">
                  {exampleCommands.map((cmd, idx) => (
                    <button
                      key={idx}
                      className="ai-editor-example"
                      onClick={() => setCommand(cmd.example)}
                    >
                      <span className="ai-editor-example-label">{cmd.label}</span>
                      <span className="ai-editor-example-text">{cmd.example}</span>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Suggestions Tab */}
          {activeTab === 'suggestions' && (
            <div className="ai-editor-suggestions">
              <div className="ai-editor-section">
                <div className="ai-editor-section-header">
                  <h3>AI Suggestions</h3>
                  <button
                    className="ai-editor-refresh-btn"
                    onClick={loadSuggestions}
                    disabled={isLoadingSuggestions}
                  >
                    <RefreshCw size={16} className={isLoadingSuggestions ? 'spinning' : ''} />
                    Refresh
                  </button>
                </div>
                <p className="ai-editor-help">
                  AI-detected improvements for your project structure, dependencies, and task sequencing.
                </p>
              </div>

              {isLoadingSuggestions ? (
                <div className="ai-editor-loading">
                  <Loader className="ai-editor-spinner" size={24} />
                  <span>Analyzing project...</span>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="ai-editor-empty">
                  <Check size={32} />
                  <p>No suggestions - your project looks well organized!</p>
                </div>
              ) : (
                <div className="ai-editor-suggestion-list">
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className={`ai-editor-suggestion ${expandedSuggestion === suggestion.id ? 'expanded' : ''}`}
                    >
                      <div
                        className="ai-editor-suggestion-header"
                        onClick={() => setExpandedSuggestion(
                          expandedSuggestion === suggestion.id ? null : suggestion.id
                        )}
                      >
                        <div className="ai-editor-suggestion-icon">
                          {getSuggestionIcon(suggestion.type)}
                        </div>
                        <div className="ai-editor-suggestion-info">
                          <span className="ai-editor-suggestion-title">{suggestion.title}</span>
                          <span
                            className="ai-editor-suggestion-priority"
                            style={{ backgroundColor: getPriorityColor(suggestion.priority) }}
                          >
                            {suggestion.priority}
                          </span>
                        </div>
                        <div className="ai-editor-suggestion-toggle">
                          {expandedSuggestion === suggestion.id ? (
                            <ChevronUp size={18} />
                          ) : (
                            <ChevronDown size={18} />
                          )}
                        </div>
                      </div>

                      {expandedSuggestion === suggestion.id && (
                        <div className="ai-editor-suggestion-details">
                          <p>{suggestion.description}</p>
                          <div className="ai-editor-suggestion-meta">
                            <span>
                              <strong>Command:</strong> <code>{suggestion.command}</code>
                            </span>
                            <span>
                              <strong>Improvement:</strong> {suggestion.estimated_improvement}
                            </span>
                            {suggestion.affected_tasks.length > 0 && (
                              <span>
                                <strong>Affects:</strong> {suggestion.affected_tasks.join(', ')}
                              </span>
                            )}
                          </div>
                          <button
                            className="ai-editor-apply-btn"
                            onClick={() => handleApplySuggestion(suggestion)}
                            disabled={applyingId === suggestion.id}
                          >
                            {applyingId === suggestion.id ? (
                              <>
                                <Loader className="ai-editor-spinner" size={16} />
                                Applying...
                              </>
                            ) : (
                              <>
                                <Check size={16} />
                                Apply This Suggestion
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="ai-editor-result error">
                  <AlertTriangle size={20} />
                  <p>{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Learn Tab */}
          {activeTab === 'learn' && (
            <div className="ai-editor-learn">
              <div className="ai-editor-section">
                <h3>Learn from Existing Projects</h3>
                <p className="ai-editor-help">
                  Analyze your existing projects to learn common patterns, typical durations,
                  and standard structures. This improves AI suggestions and project generation.
                </p>

                <button
                  className="ai-editor-learn-btn"
                  onClick={handleLearnPatterns}
                  disabled={isLearning}
                >
                  {isLearning ? (
                    <>
                      <Loader className="ai-editor-spinner" size={18} />
                      Analyzing projects...
                    </>
                  ) : (
                    <>
                      <BookOpen size={18} />
                      Analyze All Projects
                    </>
                  )}
                </button>
              </div>

              {learnedTemplate && (
                <div className="ai-editor-learned">
                  <div className="ai-editor-learned-header">
                    <Check size={20} />
                    <span>Analyzed {learnedTemplate.projects_analyzed} project(s)</span>
                  </div>

                  {learnedTemplate.common_phases.length > 0 && (
                    <div className="ai-editor-learned-section">
                      <h4>Common Phases</h4>
                      <div className="ai-editor-learned-tags">
                        {learnedTemplate.common_phases.map((phase, idx) => (
                          <span key={idx} className="ai-editor-learned-tag">{phase}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {learnedTemplate.common_tasks.length > 0 && (
                    <div className="ai-editor-learned-section">
                      <h4>Common Tasks</h4>
                      <div className="ai-editor-learned-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Task Name</th>
                              <th>Frequency</th>
                              <th>Avg Duration</th>
                            </tr>
                          </thead>
                          <tbody>
                            {learnedTemplate.common_tasks.slice(0, 10).map((task, idx) => (
                              <tr key={idx}>
                                <td>{task.name}</td>
                                <td>{task.frequency}x</td>
                                <td>{(task.avg_duration_hours / 8).toFixed(1)} days</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {learnedTemplate.common_milestones.length > 0 && (
                    <div className="ai-editor-learned-section">
                      <h4>Common Milestones</h4>
                      <div className="ai-editor-learned-tags">
                        {learnedTemplate.common_milestones.map((milestone, idx) => (
                          <span key={idx} className="ai-editor-learned-tag milestone">
                            {milestone}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(learnedTemplate.duration_norms).length > 0 && (
                    <div className="ai-editor-learned-section">
                      <h4>Duration Norms by Category</h4>
                      <div className="ai-editor-learned-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Category</th>
                              <th>Avg Duration</th>
                              <th>Samples</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(learnedTemplate.duration_norms).map(([category, data]) => (
                              <tr key={category}>
                                <td>{category.replace(/_/g, ' ')}</td>
                                <td>{((data as any).avg_hours / 8).toFixed(1)} days</td>
                                <td>{(data as any).sample_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="ai-editor-result error">
                  <AlertTriangle size={20} />
                  <p>{error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIProjectEditor;
