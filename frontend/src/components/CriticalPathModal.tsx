import React, { useState } from 'react';
import type { Task } from '../api/client';
import { X, Printer, FileText, Table as TableIcon, ToggleLeft, ToggleRight, BarChart3, Network } from 'lucide-react';
import './CriticalPathModal.css';

interface CriticalPathModalProps {
  isOpen: boolean;
  onClose: () => void;
  criticalTasks: Task[];
  projectDuration: number;
  taskFloats: Record<string, number>;
  onToggleHighlight: (show: boolean) => void;
  isHighlighting: boolean;
}

export const CriticalPathModal: React.FC<CriticalPathModalProps> = ({
  isOpen,
  onClose,
  criticalTasks,
  projectDuration,
  taskFloats,
  onToggleHighlight,
  isHighlighting,
}) => {
  const [sortBy, setSortBy] = useState<'outline' | 'duration' | 'float'>('outline');
  const [activeView, setActiveView] = useState<'table' | 'timeline' | 'network'>('timeline');

  if (!isOpen) return null;

  // Sort tasks based on selected criteria
  const sortedTasks = [...criticalTasks].sort((a, b) => {
    switch (sortBy) {
      case 'outline':
        return a.outline_number.localeCompare(b.outline_number, undefined, { numeric: true });
      case 'duration':
        return parseDuration(b.duration) - parseDuration(a.duration);
      case 'float':
        return (taskFloats[a.id] || 0) - (taskFloats[b.id] || 0);
      default:
        return 0;
    }
  });

  const parseDuration = (duration: string): number => {
    const match = duration.match(/PT(\d+)H/);
    if (match) {
      return parseInt(match[1]) / 8;
    }
    return 0;
  };

  const formatDuration = (duration: string): string => {
    const days = parseDuration(duration);
    return days === 1 ? '1 day' : `${days} days`;
  };

  const handleExportCSV = () => {
    const headers = ['WBS', 'Task Name', 'Duration', 'Float (days)', 'Start Date', 'Finish Date', 'Progress'];
    const rows = sortedTasks.map(task => [
      task.outline_number,
      task.name,
      formatDuration(task.duration),
      (taskFloats[task.id] || 0).toFixed(1),
      task.start_date || 'N/A',
      task.finish_date || 'N/A',
      `${task.percent_complete}%`,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `critical-path-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportText = () => {
    const text = [
      '═══════════════════════════════════════════════════════════',
      '                    CRITICAL PATH ANALYSIS                  ',
      '═══════════════════════════════════════════════════════════',
      '',
      `Project Duration: ${projectDuration.toFixed(1)} days`,
      `Critical Tasks: ${criticalTasks.length}`,
      `Analysis Date: ${new Date().toLocaleString()}`,
      '',
      '───────────────────────────────────────────────────────────',
      '',
      ...sortedTasks.map((task, index) => {
        return [
          `${index + 1}. ${task.name}`,
          `   WBS: ${task.outline_number}`,
          `   Duration: ${formatDuration(task.duration)}`,
          `   Float: ${(taskFloats[task.id] || 0).toFixed(1)} days`,
          `   Progress: ${task.percent_complete}%`,
          '',
        ].join('\n');
      }),
      '═══════════════════════════════════════════════════════════',
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `critical-path-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="critical-path-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <h2>Critical Path Analysis</h2>
            <p className="modal-subtitle">
              {criticalTasks.length} critical tasks • {projectDuration.toFixed(1)} days total duration
            </p>
          </div>
          <button className="modal-close" onClick={onClose} title="Close">
            <X size={24} />
          </button>
        </div>

        <div className="modal-actions">
          <div className="action-group">
            <button className="action-button" onClick={handleExportCSV} title="Export as CSV">
              <TableIcon size={18} />
              Export CSV
            </button>
            <button className="action-button" onClick={handleExportText} title="Export as Text">
              <FileText size={18} />
              Export TXT
            </button>
            <button className="action-button" onClick={handlePrint} title="Print">
              <Printer size={18} />
              Print
            </button>
          </div>

          <div className="action-group">
            <button
              className={`action-button highlight-toggle ${isHighlighting ? 'active' : ''}`}
              onClick={() => onToggleHighlight(!isHighlighting)}
              title={isHighlighting ? 'Hide highlighting on chart' : 'Show highlighting on chart'}
            >
              {isHighlighting ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
              {isHighlighting ? 'Hide Highlighting' : 'Show Highlighting'}
            </button>
          </div>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab-button ${activeView === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveView('timeline')}
          >
            <BarChart3 size={18} />
            Timeline View
          </button>
          <button
            className={`tab-button ${activeView === 'network' ? 'active' : ''}`}
            onClick={() => setActiveView('network')}
          >
            <Network size={18} />
            Network Diagram
          </button>
          <button
            className={`tab-button ${activeView === 'table' ? 'active' : ''}`}
            onClick={() => setActiveView('table')}
          >
            <TableIcon size={18} />
            Data Table
          </button>
        </div>

        {activeView === 'table' && (
          <div className="modal-controls">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="outline">WBS Number</option>
              <option value="duration">Duration</option>
              <option value="float">Float</option>
            </select>
          </div>
        )}

        <div className="modal-content">
          {activeView === 'timeline' && (
            <div className="timeline-view">
              <div className="timeline-header">
                <h3>Critical Path Timeline</h3>
                <p>Visual representation of critical tasks in chronological order</p>
              </div>
              <div className="timeline-container">
                {sortedTasks.map((task, index) => {
                  const float = taskFloats[task.id] || 0;
                  const progress = task.percent_complete;

                  return (
                    <div key={task.id} className="timeline-item">
                      <div className="timeline-marker">
                        <div className="timeline-dot" />
                        {index < sortedTasks.length - 1 && <div className="timeline-line" />}
                      </div>
                      <div className="timeline-card">
                        <div className="timeline-card-header">
                          <div className="timeline-card-title">
                            <span className="timeline-wbs">{task.outline_number}</span>
                            <span className="timeline-name">{task.name}</span>
                          </div>
                          <div className="timeline-card-badges">
                            <span className="badge duration-badge">{formatDuration(task.duration)}</span>
                            <span className="badge float-badge">Float: {float.toFixed(1)}d</span>
                          </div>
                        </div>
                        <div className="timeline-card-body">
                          <div className="timeline-progress">
                            <div className="timeline-progress-bar" style={{ width: `${progress}%` }}>
                              <span className="timeline-progress-text">{progress}%</span>
                            </div>
                          </div>
                          <div className="timeline-dates">
                            <span>📅 Start: {task.start_date ? new Date(task.start_date).toLocaleDateString() : 'N/A'}</span>
                            <span>🏁 Finish: {task.finish_date ? new Date(task.finish_date).toLocaleDateString() : 'N/A'}</span>
                          </div>
                        </div>
                        {task.predecessors && task.predecessors.length > 0 && (
                          <div className="timeline-dependencies">
                            <span className="dep-label">Dependencies:</span>
                            {task.predecessors.map((pred, i) => (
                              <span key={i} className="dep-badge">
                                {pred.outline_number}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeView === 'network' && (
            <div className="network-view">
              <div className="network-header">
                <h3>Critical Path Network Diagram</h3>
                <p>PERT-style visualization showing task dependencies and flow • Scroll horizontally and vertically to explore • {sortedTasks.length} tasks</p>
              </div>
              <div className="network-container">
                <svg className="network-svg" width={Math.max(1400, sortedTasks.length * 280)} height={Math.max(600, Math.ceil(sortedTasks.length / 4) * 150 + 100)}>
                  {sortedTasks.map((task, index) => {
                    const x = 80 + (index % 4) * 320;
                    const y = 60 + Math.floor(index / 4) * 180;
                    const duration = parseDuration(task.duration);

                    return (
                      <g key={task.id}>
                        {/* Connection lines to predecessors */}
                        {task.predecessors && task.predecessors.map((pred, i) => {
                          const predIndex = sortedTasks.findIndex(t => t.outline_number === pred.outline_number);
                          if (predIndex >= 0) {
                            const predX = 80 + (predIndex % 4) * 320;
                            const predY = 60 + Math.floor(predIndex / 4) * 180;
                            return (
                              <line
                                key={i}
                                x1={predX + 120}
                                y1={predY + 50}
                                x2={x}
                                y2={y + 50}
                                stroke="#e74c3c"
                                strokeWidth="3"
                                markerEnd="url(#arrowhead)"
                                opacity="0.8"
                              />
                            );
                          }
                          return null;
                        })}

                        {/* Task node */}
                        <rect
                          x={x}
                          y={y}
                          width="240"
                          height="100"
                          fill="#fff"
                          stroke="#e74c3c"
                          strokeWidth="3"
                          rx="8"
                          className="network-node"
                        />
                        <text x={x + 120} y={y + 30} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#e74c3c">
                          {task.outline_number}
                        </text>
                        <text x={x + 120} y={y + 52} textAnchor="middle" fontSize="12" fill="#2c3e50" fontWeight="600">
                          {task.name.length > 25 ? task.name.substring(0, 25) + '...' : task.name}
                        </text>
                        <text x={x + 120} y={y + 72} textAnchor="middle" fontSize="11" fill="#7f8c8d">
                          Duration: {duration} days
                        </text>
                        <text x={x + 120} y={y + 88} textAnchor="middle" fontSize="11" fill="#27ae60" fontWeight="600">
                          Progress: {task.percent_complete}%
                        </text>
                      </g>
                    );
                  })}

                  {/* Arrow marker definition */}
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="12"
                      markerHeight="12"
                      refX="10"
                      refY="6"
                      orient="auto"
                    >
                      <polygon points="0 0, 12 6, 0 12" fill="#e74c3c" />
                    </marker>
                  </defs>
                </svg>
              </div>
            </div>
          )}

          {activeView === 'table' && (
            <div className="table-view">
            <table className="critical-path-table">
            <thead>
              <tr>
                <th>#</th>
                <th>WBS</th>
                <th>Task Name</th>
                <th>Duration</th>
                <th>Float</th>
                <th>Progress</th>
                <th>Start Date</th>
                <th>Finish Date</th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map((task, index) => (
                <tr key={task.id}>
                  <td>{index + 1}</td>
                  <td className="wbs-cell">{task.outline_number}</td>
                  <td className="task-name-cell">{task.name}</td>
                  <td>{formatDuration(task.duration)}</td>
                  <td className="float-cell">{(taskFloats[task.id] || 0).toFixed(1)} days</td>
                  <td>
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{ width: `${task.percent_complete}%` }} />
                      <span className="progress-text">{task.percent_complete}%</span>
                    </div>
                  </td>
                  <td>{task.start_date ? new Date(task.start_date).toLocaleDateString() : 'N/A'}</td>
                  <td>{task.finish_date ? new Date(task.finish_date).toLocaleDateString() : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="modal-info">
            <p><strong>What is Critical Path?</strong></p>
            <p>
              The critical path is the sequence of tasks that determines the minimum project duration.
              Tasks on the critical path have zero or near-zero float (slack time), meaning any delay
              in these tasks will delay the entire project.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

