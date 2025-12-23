import React, { useState, useEffect } from 'react';
import type { Task, TaskCreate, TaskUpdate, Predecessor } from '../api/client';
import { X, Plus, Trash2 } from 'lucide-react';

interface TaskEditorProps {
  task?: Task;
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: TaskCreate | TaskUpdate) => void;
  onDelete?: (taskId: string) => void;
  existingTasks: Task[];
}

// Helper function to convert ISO 8601 duration to days
const durationToDays = (duration: string): number => {
  const match = duration.match(/PT(\d+)H/);
  if (match) {
    const hours = parseInt(match[1]);
    return hours / 8; // Assuming 8-hour workday
  }
  return 1;
};

// Helper function to convert days to ISO 8601 duration
const daysToDuration = (days: number): string => {
  const hours = days * 8; // Assuming 8-hour workday
  return `PT${hours}H0M0S`;
};

export const TaskEditor: React.FC<TaskEditorProps> = ({
  task,
  isOpen,
  onClose,
  onSave,
  onDelete,
  existingTasks,
}) => {
  const [formData, setFormData] = useState<TaskCreate>({
    name: '',
    outline_number: '',
    duration: 'PT8H0M0S',
    value: '',
    milestone: false,
    percent_complete: 0,
    predecessors: [],
  });

  const [durationDays, setDurationDays] = useState<number>(1);

  // Check if this task is a summary task (has children)
  const isSummaryTask = (outlineNumber: string): boolean => {
    return existingTasks.some(t =>
      t.outline_number.startsWith(outlineNumber + '.') &&
      t.outline_number !== outlineNumber
    );
  };

  const isCurrentTaskSummary = task ? isSummaryTask(task.outline_number) : false;

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        outline_number: task.outline_number,
        duration: task.duration,
        value: task.value,
        milestone: task.milestone,
        percent_complete: task.percent_complete,
        predecessors: task.predecessors,
      });
      setDurationDays(durationToDays(task.duration));
    } else {
      setFormData({
        name: '',
        outline_number: '',
        duration: 'PT8H0M0S',
        value: '',
        milestone: false,
        percent_complete: 0,
        predecessors: [],
      });
      setDurationDays(1);
    }
  }, [task, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addPredecessor = () => {
    setFormData({
      ...formData,
      predecessors: [
        ...(formData.predecessors || []),
        { outline_number: '', type: 1, lag: 0, lag_format: 7 },
      ],
    });
  };

  const updatePredecessor = (index: number, field: keyof Predecessor, value: any) => {
    const newPredecessors = [...(formData.predecessors || [])];
    newPredecessors[index] = { ...newPredecessors[index], [field]: value };
    setFormData({ ...formData, predecessors: newPredecessors });
  };

  const removePredecessor = (index: number) => {
    const newPredecessors = [...(formData.predecessors || [])];
    newPredecessors.splice(index, 1);
    setFormData({ ...formData, predecessors: newPredecessors });
  };

  const handleDelete = () => {
    if (!task || !onDelete) return;

    const confirmMessage = `Are you sure you want to delete task "${task.name}" (${task.outline_number})?\n\nThis action cannot be undone.`;

    if (window.confirm(confirmMessage)) {
      onDelete(task.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task ? 'Edit Task' : 'Create Task'}</h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="task-form">
          {isCurrentTaskSummary && (
            <div className="summary-task-notice">
              <strong>⚠️ Summary Task:</strong> This task has child tasks. Duration and dates are automatically calculated from children. Predecessors should be added to child tasks.
            </div>
          )}

          <div className="form-group">
            <label>Task Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Outline Number *</label>
              <input
                type="text"
                value={formData.outline_number}
                onChange={(e) => setFormData({ ...formData, outline_number: e.target.value })}
                placeholder="e.g., 1.2.3"
                required
                disabled={!!task}
              />
              <small className="field-hint">Cannot be changed after creation</small>
            </div>

            <div className="form-group">
              <label>Duration (days)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={durationDays}
                onChange={(e) => {
                  const days = parseFloat(e.target.value) || 0;
                  setDurationDays(days);
                  setFormData({ ...formData, duration: daysToDuration(days) });
                }}
                placeholder="1"
                disabled={formData.milestone || isCurrentTaskSummary}
              />
              <small className="field-hint">
                {isCurrentTaskSummary
                  ? 'Auto-calculated from child tasks'
                  : '1 day = 8 hours. Use 0.5 for half day, 5 for a week, etc.'}
              </small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Custom Value</label>
              <input
                type="text"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Percent Complete (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={formData.percent_complete || 0}
                onChange={(e) => {
                  const pct = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                  setFormData({ ...formData, percent_complete: pct });
                }}
                placeholder="0"
              />
              <small className="field-hint">0 = Not started, 100 = Complete</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.milestone}
                  disabled={isCurrentTaskSummary}
                  onChange={(e) => {
                    const isMilestone = e.target.checked;
                    if (isMilestone) {
                      setDurationDays(0);
                      setFormData({ ...formData, milestone: isMilestone, duration: 'PT0H0M0S' });
                    } else {
                      setDurationDays(1);
                      setFormData({ ...formData, milestone: isMilestone, duration: 'PT8H0M0S' });
                    }
                  }}
                />
                Milestone (zero duration)
              </label>
            </div>
          </div>

          {!isCurrentTaskSummary && (
            <div className="form-group">
              <div className="predecessors-header">
                <label>Predecessors</label>
                <button type="button" className="add-button" onClick={addPredecessor}>
                  <Plus size={16} /> Add Predecessor
                </button>
              </div>

              {formData.predecessors?.map((pred, index) => (
                <div key={index} className="predecessor-row">
                  <select
                    value={pred.outline_number}
                    onChange={(e) => updatePredecessor(index, 'outline_number', e.target.value)}
                  >
                    <option value="">Select task...</option>
                    {existingTasks.map((t) => (
                      <option key={t.id} value={t.outline_number}>
                        {t.outline_number} - {t.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={pred.type}
                    onChange={(e) => updatePredecessor(index, 'type', parseInt(e.target.value))}
                  >
                    <option value={1}>Finish-to-Start (FS)</option>
                    <option value={2}>Start-to-Start (SS)</option>
                    <option value={3}>Finish-to-Finish (FF)</option>
                    <option value={4}>Start-to-Finish (SF)</option>
                  </select>

                  <input
                    type="number"
                    value={pred.lag}
                    onChange={(e) => updatePredecessor(index, 'lag', parseInt(e.target.value))}
                    placeholder="Lag"
                    className="lag-input"
                  />

                  <button
                    type="button"
                    className="remove-button"
                    onClick={() => removePredecessor(index)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="modal-footer">
            <div className="modal-footer-left">
              {task && onDelete && (
                <button
                  type="button"
                  className="delete-button"
                  onClick={handleDelete}
                  title="Delete this task"
                >
                  <Trash2 size={16} />
                  Delete Task
                </button>
              )}
            </div>
            <div className="modal-footer-right">
              <button type="button" className="cancel-button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="save-button">
                {task ? 'Update' : 'Create'} Task
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

