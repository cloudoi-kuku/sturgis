import React, { useState, useEffect } from 'react';
import type { Task, TaskCreate, TaskUpdate, Predecessor } from '../api/client';
import { ConstraintType, CONSTRAINT_TYPE_LABELS } from '../api/client';
import { Plus, Trash2, X, Lock } from 'lucide-react';
import { AITaskHelper } from './AITaskHelper';

interface TaskEditorProps {
  task?: Task;
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: TaskCreate | TaskUpdate) => void;
  onDelete?: (taskId: string) => void;
  existingTasks: Task[];
  quickAddContext?: {
    position: 'before' | 'after' | 'child';
    referenceTask: Task;
  } | null;
}

// Helper function to convert ISO 8601 duration to days
const durationToDays = (duration: string): number => {
  const match = duration.match(/PT(\d+)H/);
  if (match) {
    const hours = parseInt(match[1]);
    return hours / 8;
  }
  return 1;
};

// Helper function to convert days to ISO 8601 duration
const daysToDuration = (days: number): string => {
  const hours = days * 8;
  return `PT${hours}H0M0S`;
};

export const TaskEditor: React.FC<TaskEditorProps> = ({
  task,
  isOpen,
  onClose,
  onSave,
  onDelete,
  existingTasks,
  quickAddContext,
}) => {
  const [formData, setFormData] = useState<TaskCreate & { start_date?: string; finish_date?: string }>({
    name: '',
    outline_number: '',
    duration: 'PT8H0M0S',
    value: '',
    milestone: false,
    percent_complete: 0,
    predecessors: [],
    constraint_type: ConstraintType.AS_SOON_AS_POSSIBLE,
    constraint_date: undefined,
    start_date: undefined,
    finish_date: undefined,
  });

  const [durationDays, setDurationDays] = useState<number>(1);

  const isSummaryTask = (outlineNumber: string): boolean => {
    return existingTasks.some(t =>
      t.outline_number.startsWith(outlineNumber + '.') &&
      t.outline_number !== outlineNumber
    );
  };

  const isCurrentTaskSummary = task ? isSummaryTask(task.outline_number) : false;

  // Calculate the outline number based on position
  // Backend now supports auto-renumbering, so we can suggest exact positions
  const calculateOutlineNumber = (position: 'before' | 'after' | 'child', refTask: Task, tasks: Task[]): string => {
    const refOutline = refTask.outline_number;
    const outlineParts = refOutline.split('.');

    if (position === 'child') {
      // Add as child: find the next available child number under this task
      const childPrefix = refOutline + '.';
      const directChildren = tasks
        .filter(t => {
          if (!t.outline_number.startsWith(childPrefix)) return false;
          // Only direct children (no additional dots after prefix)
          const remainder = t.outline_number.substring(childPrefix.length);
          return !remainder.includes('.');
        })
        .map(t => {
          const remainder = t.outline_number.substring(childPrefix.length);
          return parseInt(remainder, 10);
        })
        .filter(n => !isNaN(n));

      const nextChildNum = directChildren.length > 0 ? Math.max(...directChildren) + 1 : 1;
      return `${refOutline}.${nextChildNum}`;
    } else if (position === 'before') {
      // Insert BEFORE: use the same outline number as reference task
      // Backend will automatically shift the existing task and siblings after it
      return refOutline;
    } else {
      // Insert AFTER: use reference task's number + 1
      // Backend will automatically shift if that number already exists
      const parentParts = outlineParts.slice(0, -1);
      const parentOutline = parentParts.join('.');
      const currentNum = parseInt(outlineParts[outlineParts.length - 1], 10);
      const nextNum = currentNum + 1;
      return parentOutline ? `${parentOutline}.${nextNum}` : `${nextNum}`;
    }
  };

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
        constraint_type: task.constraint_type ?? ConstraintType.AS_SOON_AS_POSSIBLE,
        constraint_date: task.constraint_date,
        start_date: task.start_date,
        finish_date: task.finish_date,
      });
      setDurationDays(durationToDays(task.duration));
    } else if (quickAddContext) {
      // Quick add mode - calculate suggested outline number
      const suggestedOutline = calculateOutlineNumber(
        quickAddContext.position,
        quickAddContext.referenceTask,
        existingTasks
      );

      console.log('Quick add context:', {
        position: quickAddContext.position,
        refTask: quickAddContext.referenceTask.outline_number,
        suggestedOutline,
        existingTaskCount: existingTasks.length
      });

      // Set up predecessors based on position:
      // - "after": Add reference task as FS predecessor (new task depends on reference)
      // - "before": No predecessor (reference task will depend on new task)
      // - "child": No automatic predecessor
      const predecessors: Predecessor[] = quickAddContext.position === 'after'
        ? [{ outline_number: quickAddContext.referenceTask.outline_number, type: 1, lag: 0, lag_format: 7 }]
        : [];

      setFormData({
        name: '',
        outline_number: suggestedOutline,
        duration: 'PT8H0M0S',
        value: '',
        milestone: false,
        percent_complete: 0,
        predecessors,
        constraint_type: ConstraintType.AS_SOON_AS_POSSIBLE,
        constraint_date: undefined,
      });
      setDurationDays(1);
    } else {
      setFormData({
        name: '',
        outline_number: '',
        duration: 'PT8H0M0S',
        value: '',
        milestone: false,
        percent_complete: 0,
        predecessors: [],
        constraint_type: ConstraintType.AS_SOON_AS_POSSIBLE,
        constraint_date: undefined,
      });
      setDurationDays(1);
    }
  }, [task, isOpen, quickAddContext, existingTasks]);

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
    // For non-summary tasks, confirm directly. For summary tasks, App.tsx handles the dialog.
    if (!task.summary) {
      const confirmMessage = `Are you sure you want to delete task "${task.name}" (${task.outline_number})?\n\nThis action cannot be undone.`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }
    onDelete(task.id);
    onClose();
  };

  if (!isOpen) return null;

  // Styles - using inline styles for better control
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: '#334155',
    marginBottom: '12px'
  };
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '48px',
    padding: '0 16px',
    fontSize: '14px',
    color: '#0f172a',
    backgroundColor: '#fff',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    outline: 'none'
  };
  const inputDisabledStyle: React.CSSProperties = {
    ...inputStyle,
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    cursor: 'not-allowed'
  };
  const helperStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '8px'
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 999
        }}
      />
      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'calc(100% - 40px)',
          maxWidth: '720px',
          maxHeight: '85vh',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 1000,
          border: '1px solid #e2e8f0'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            right: '16px',
            top: '16px',
            padding: '8px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#64748b',
            zIndex: 10
          }}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
            {task ? 'Edit Task' : quickAddContext
              ? `Add Task ${quickAddContext.position === 'child' ? 'Under' : quickAddContext.position === 'after' ? 'After' : 'Before'} "${quickAddContext.referenceTask.name.substring(0, 30)}${quickAddContext.referenceTask.name.length > 30 ? '...' : ''}"`
              : 'Create New Task'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Scrollable Content */}
          <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px', overflowY: 'auto', flex: 1 }}>
            {/* Summary Task Warning */}
            {isCurrentTaskSummary && (
              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '16px' }}>
                <p style={{ fontSize: '14px', color: '#92400e', margin: 0 }}>
                  <strong>⚠️ Summary Task:</strong> Duration and dates are auto-calculated from child tasks.
                </p>
              </div>
            )}

            {/* Task Name */}
            <div>
              <label htmlFor="taskName" style={labelStyle}>
                Task Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="taskName"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter task name"
                style={inputStyle}
              />
            </div>

            {/* AI Helper */}
            {!isCurrentTaskSummary && !formData.milestone && (
              <AITaskHelper
                taskName={formData.name}
                onDurationSuggest={(days) => {
                  setDurationDays(days);
                  setFormData({ ...formData, duration: daysToDuration(days) });
                }}
              />
            )}

            {/* Row: Outline Number & Duration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              <div>
                <label htmlFor="outlineNumber" style={labelStyle}>
                  Outline Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="outlineNumber"
                  type="text"
                  value={formData.outline_number}
                  onChange={(e) => setFormData({ ...formData, outline_number: e.target.value })}
                  placeholder="e.g., 1.2.3"
                  required
                  disabled={!!task}
                  style={task ? inputDisabledStyle : inputStyle}
                />
                <p style={helperStyle}>Cannot be changed after creation</p>
              </div>

              <div>
                <label htmlFor="duration" style={labelStyle}>Duration (days)</label>
                <input
                  id="duration"
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
                  style={(formData.milestone || isCurrentTaskSummary) ? inputDisabledStyle : inputStyle}
                />
                <p style={helperStyle}>
                  {isCurrentTaskSummary ? 'Auto-calculated' : '1 day = 8 hours'}
                </p>
              </div>
            </div>

            {/* Row: Custom Value & Percent Complete */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              <div>
                <label htmlFor="customValue" style={labelStyle}>Custom Value</label>
                <input
                  id="customValue"
                  type="text"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  placeholder="Optional"
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="percentComplete" style={labelStyle}>Percent Complete (%)</label>
                <input
                  id="percentComplete"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.percent_complete || 0}
                  onChange={(e) => {
                    const pct = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                    setFormData({ ...formData, percent_complete: pct });
                  }}
                  placeholder="0"
                  style={inputStyle}
                />
                <p style={helperStyle}>0 = Not started, 100 = Complete</p>
              </div>
            </div>

            {/* Milestone Checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <input
                id="milestone"
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
                style={{ width: '18px', height: '18px' }}
              />
              <label htmlFor="milestone" style={{ fontSize: '14px', fontWeight: 500, color: '#334155', cursor: 'pointer' }}>
                Milestone (zero duration)
              </label>
            </div>

            {/* Task Constraints Section */}
            {!isCurrentTaskSummary && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lock size={16} style={{ color: '#64748b' }} />
                  <span style={{ ...labelStyle, marginBottom: 0 }}>Task Constraint</span>
                </div>

                <div style={{ padding: '24px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: formData.constraint_type !== undefined && formData.constraint_type >= 2 ? '1fr 1fr' : '1fr', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '8px' }}>Constraint Type</label>
                      <select
                        value={formData.constraint_type ?? ConstraintType.AS_SOON_AS_POSSIBLE}
                        onChange={(e) => {
                          const newType = parseInt(e.target.value);
                          // Clear constraint_date if switching to ASAP or ALAP
                          if (newType < 2) {
                            setFormData({ ...formData, constraint_type: newType, constraint_date: undefined });
                          } else {
                            setFormData({ ...formData, constraint_type: newType });
                          }
                        }}
                        style={{ ...inputStyle, height: '48px' }}
                      >
                        {Object.entries(CONSTRAINT_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <p style={helperStyle}>
                        {formData.constraint_type === ConstraintType.AS_SOON_AS_POSSIBLE && 'Default: Schedule task as early as possible'}
                        {formData.constraint_type === ConstraintType.AS_LATE_AS_POSSIBLE && 'Schedule task as late as possible without delaying successors'}
                        {formData.constraint_type === ConstraintType.MUST_START_ON && 'Task must start exactly on the specified date'}
                        {formData.constraint_type === ConstraintType.MUST_FINISH_ON && 'Task must finish exactly on the specified date'}
                        {formData.constraint_type === ConstraintType.START_NO_EARLIER_THAN && 'Task cannot start before the specified date'}
                        {formData.constraint_type === ConstraintType.START_NO_LATER_THAN && 'Task must start by the specified date'}
                        {formData.constraint_type === ConstraintType.FINISH_NO_EARLIER_THAN && 'Task cannot finish before the specified date'}
                        {formData.constraint_type === ConstraintType.FINISH_NO_LATER_THAN && 'Task must finish by the specified date'}
                      </p>
                    </div>

                    {/* Show date picker for constraint types 2-7 */}
                    {formData.constraint_type !== undefined && formData.constraint_type >= 2 && (
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '8px' }}>
                          Constraint Date <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="date"
                          value={formData.constraint_date ? formData.constraint_date.split('T')[0] : ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value) {
                              setFormData({ ...formData, constraint_date: value + 'T08:00:00' });
                            }
                          }}
                          required={formData.constraint_type >= 2}
                          style={{ ...inputStyle, height: '48px' }}
                        />
                        <p style={helperStyle}>Required for this constraint type</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Task Dates Section - Only show when editing existing task */}
            {task && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px' }}>
                <span style={{ ...labelStyle, marginBottom: 0 }}>Task Dates</span>
                <div style={{ padding: '24px', backgroundColor: isCurrentTaskSummary ? '#fffbeb' : '#f8fafc', border: `1px solid ${isCurrentTaskSummary ? '#fde68a' : '#e2e8f0'}`, borderRadius: '8px' }}>
                  {isCurrentTaskSummary && (
                    <p style={{ fontSize: '12px', color: '#92400e', marginBottom: '16px' }}>
                      Summary task dates are calculated from child tasks and cannot be edited directly.
                    </p>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '8px' }}>Start Date</label>
                      <input
                        type="date"
                        value={formData.start_date ? formData.start_date.split('T')[0] : ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value) {
                            setFormData({ ...formData, start_date: value + 'T08:00:00' });
                          } else {
                            setFormData({ ...formData, start_date: undefined });
                          }
                        }}
                        disabled={isCurrentTaskSummary}
                        style={isCurrentTaskSummary ? inputDisabledStyle : { ...inputStyle, height: '48px' }}
                      />
                      <p style={helperStyle}>{isCurrentTaskSummary ? 'Auto-calculated from children' : 'When the task begins'}</p>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '8px' }}>Finish Date</label>
                      <input
                        type="date"
                        value={formData.finish_date ? formData.finish_date.split('T')[0] : ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value) {
                            setFormData({ ...formData, finish_date: value + 'T17:00:00' });
                          } else {
                            setFormData({ ...formData, finish_date: undefined });
                          }
                        }}
                        disabled={isCurrentTaskSummary}
                        style={isCurrentTaskSummary ? inputDisabledStyle : { ...inputStyle, height: '48px' }}
                      />
                      <p style={helperStyle}>{isCurrentTaskSummary ? 'Auto-calculated from children' : 'When the task ends'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Predecessors Section */}
            {!isCurrentTaskSummary && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ ...labelStyle, marginBottom: 0 }}>Predecessors</span>
                  <button
                    type="button"
                    onClick={addPredecessor}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 500, color: '#4f46e5', backgroundColor: 'transparent', border: '1px solid #c7d2fe', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    <Plus size={16} />
                    Add Predecessor
                  </button>
                </div>

                {formData.predecessors?.map((pred, index) => (
                  <div key={index} style={{ padding: '24px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '8px' }}>Task</label>
                        <select
                          value={pred.outline_number}
                          onChange={(e) => updatePredecessor(index, 'outline_number', e.target.value)}
                          style={{ ...inputStyle, height: '48px' }}
                        >
                          <option value="">Select...</option>
                          {existingTasks.map((t) => (
                            <option key={t.id} value={t.outline_number}>
                              {t.outline_number} - {t.name.slice(0, 25)}{t.name.length > 25 ? '...' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '8px' }}>Type</label>
                        <select
                          value={pred.type}
                          onChange={(e) => updatePredecessor(index, 'type', parseInt(e.target.value))}
                          style={{ ...inputStyle, height: '48px' }}
                        >
                          <option value={1}>Finish-to-Start (FS)</option>
                          <option value={0}>Finish-to-Finish (FF)</option>
                          <option value={2}>Start-to-Finish (SF)</option>
                          <option value={3}>Start-to-Start (SS)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#475569', marginBottom: '8px' }}>Lag (days)</label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <input
                            type="number"
                            step="0.5"
                            value={(() => {
                              const lagFormat = pred.lag_format || 7;
                              const lagValue = pred.lag || 0;
                              switch (lagFormat) {
                                case 3: return lagValue / 480;
                                case 4: return lagValue / 1440;
                                case 5: return lagValue / 8;
                                case 6: return lagValue / 24;
                                case 7: return lagValue;
                                case 8: return lagValue;
                                case 9: return lagValue * 5;
                                case 10: return lagValue * 7;
                                case 11: return lagValue * 20;
                                case 12: return lagValue * 30;
                                default: return lagValue / 480;
                              }
                            })()}
                            onChange={(e) => {
                              const days = parseFloat(e.target.value) || 0;
                              const lagFormat = pred.lag_format || 7;
                              let lagValue;
                              switch (lagFormat) {
                                case 3: lagValue = days * 480; break;
                                case 4: lagValue = days * 1440; break;
                                case 5: lagValue = days * 8; break;
                                case 6: lagValue = days * 24; break;
                                case 7: lagValue = days; break;
                                case 8: lagValue = days; break;
                                case 9: lagValue = days / 5; break;
                                case 10: lagValue = days / 7; break;
                                case 11: lagValue = days / 20; break;
                                case 12: lagValue = days / 30; break;
                                default: lagValue = days * 480; break;
                              }
                              updatePredecessor(index, 'lag', Math.round(lagValue * 100) / 100);
                            }}
                            placeholder="0"
                            style={{ ...inputStyle, height: '48px', flex: 1 }}
                          />
                          <button
                            type="button"
                            onClick={() => removePredecessor(index)}
                            style={{ height: '48px', width: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', backgroundColor: 'transparent', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer - Fixed at Bottom */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <div>
              {task && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', fontSize: '14px', fontWeight: 500, color: '#dc2626', backgroundColor: 'transparent', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Task
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '12px 24px', fontSize: '14px', fontWeight: 500, color: '#334155', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '12px 32px', fontSize: '14px', fontWeight: 500, color: '#fff', backgroundColor: '#4f46e5', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                {task ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
};
