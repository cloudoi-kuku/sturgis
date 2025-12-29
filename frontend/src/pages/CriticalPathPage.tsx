import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../api/client';
import { Printer, FileText, Table as TableIcon, BarChart3, Network, ArrowLeft } from 'lucide-react';
import { parseISO, addDays, format } from 'date-fns';
import './CriticalPathPage.css';

interface CriticalPathPageProps {
  criticalTasks: Task[];
  projectDuration: number;
  taskFloats: Record<string, number>;
  projectStartDate?: string;
}

export const CriticalPathPage: React.FC<CriticalPathPageProps> = ({
  criticalTasks,
  projectDuration,
  taskFloats,
  projectStartDate,
}) => {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'outline' | 'duration' | 'float'>('outline');
  const [activeView, setActiveView] = useState<'table' | 'timeline' | 'network'>('timeline');

  const parseDuration = (duration: string): number => {
    const match = duration.match(/PT(\d+)H/);
    if (match) {
      return parseInt(match[1]) / 8;
    }
    return 0;
  };

  const formatDuration = (duration: string): string => {
    const days = parseDuration(duration);
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  // Format day number to readable format (Day 1, Day 2, etc.)
  const formatDayNumber = (dayNum: number | undefined): string => {
    if (dayNum === undefined || dayNum === null) return 'N/A';
    return `Day ${Math.round(dayNum * 10) / 10}`;
  };

  // Convert day number to actual calendar date
  const dayToDate = (dayNum: number | undefined): string => {
    if (dayNum === undefined || dayNum === null || !projectStartDate) return 'N/A';
    try {
      const startDate = parseISO(projectStartDate);
      const targetDate = addDays(startDate, dayNum);
      return format(targetDate, 'MMM d, yyyy');
    } catch {
      return 'N/A';
    }
  };

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

  const handleExportCSV = () => {
    const headers = ['WBS', 'Task Name', 'Duration', 'Start Date', 'Finish Date', 'Float (days)', 'Progress (%)'];
    const rows = sortedTasks.map(task => [
      task.outline_number,
      task.name,
      formatDuration(task.duration),
      dayToDate(task.early_start),
      dayToDate(task.early_finish),
      (taskFloats[task.id] || 0).toFixed(1),
      task.percent_complete.toString(),
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

  const handleExportText = () => {
    const text = [
      'CRITICAL PATH ANALYSIS',
      '═══════════════════════════════════════════════════════════',
      `Total Critical Tasks: ${criticalTasks.length}`,
      `Project Duration: ${projectDuration.toFixed(1)} days`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'CRITICAL TASKS:',
      '───────────────────────────────────────────────────────────',
      '',
      ...sortedTasks.map((task, index) => {
        return [
          `${index + 1}. ${task.name}`,
          `   WBS: ${task.outline_number}`,
          `   Duration: ${formatDuration(task.duration)}`,
          `   Start: ${dayToDate(task.early_start)}`,
          `   Finish: ${dayToDate(task.early_finish)}`,
          `   Float: ${(taskFloats[task.id] || 0).toFixed(1)} days | Progress: ${task.percent_complete}%`,
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="critical-path-page">
      <div className="page-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate(-1)} title="Back">
            <ArrowLeft size={24} />
          </button>
          <div className="page-title">
            <h1>Critical Path Analysis</h1>
            <p className="page-subtitle">
              {criticalTasks.length} critical tasks • {projectDuration.toFixed(1)} days total duration
            </p>
          </div>
        </div>
        <div className="header-actions">
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
      </div>

      <div className="page-tabs">
        <button
          className={`tab-button ${activeView === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveView('timeline')}
        >
          <BarChart3 size={20} />
          Timeline View
        </button>
        <button
          className={`tab-button ${activeView === 'network' ? 'active' : ''}`}
          onClick={() => setActiveView('network')}
        >
          <Network size={20} />
          Network Diagram
        </button>
        <button
          className={`tab-button ${activeView === 'table' ? 'active' : ''}`}
          onClick={() => setActiveView('table')}
        >
          <TableIcon size={20} />
          Data Table
        </button>
      </div>

      {activeView !== 'network' && (
        <div className="page-controls">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="outline">WBS Number</option>
            <option value="duration">Duration</option>
            <option value="float">Float</option>
          </select>
        </div>
      )}

      <div className="page-content">
        {activeView === 'timeline' && (
          <div className="timeline-view">
            <div className="timeline-header">
              <h2>Critical Path Timeline</h2>
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
                          <span>Start: {dayToDate(task.early_start)}</span>
                          <span>Finish: {dayToDate(task.early_finish)}</span>
                        </div>
                        <div className="timeline-cpm-dates">
                          <div className="cpm-row">
                            <div className="cpm-item early">
                              <span className="cpm-label">Early Start</span>
                              <span className="cpm-value">{formatDayNumber(task.early_start)}</span>
                            </div>
                            <div className="cpm-item early">
                              <span className="cpm-label">Early Finish</span>
                              <span className="cpm-value">{formatDayNumber(task.early_finish)}</span>
                            </div>
                          </div>
                          <div className="cpm-row">
                            <div className="cpm-item late">
                              <span className="cpm-label">Late Start</span>
                              <span className="cpm-value">{formatDayNumber(task.late_start)}</span>
                            </div>
                            <div className="cpm-item late">
                              <span className="cpm-label">Late Finish</span>
                              <span className="cpm-value">{formatDayNumber(task.late_finish)}</span>
                            </div>
                          </div>
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
            <div className="info-section">
              <h3>What is Critical Path?</h3>
              <p>
                The critical path is the sequence of tasks that determines the minimum project duration. Tasks on the critical path have zero or near-zero float (slack time), meaning
                any delay in these tasks will delay the entire project.
              </p>
            </div>
          </div>
        )}

        {activeView === 'network' && (
          <div className="network-view">
            <div className="network-header">
              <h2>Critical Path Network Diagram</h2>
              <p>CPM Activity-on-Node diagram showing ES/EF/LS/LF • {sortedTasks.length} critical tasks</p>
            </div>
            <div className="network-container">
              <svg className="network-svg" width={Math.max(1200, sortedTasks.length * 340)} height={220}>
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 5, 0 10" fill="#e74c3c" />
                  </marker>
                  <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#fff5f5" />
                    <stop offset="100%" stopColor="#ffffff" />
                  </linearGradient>
                </defs>

                {sortedTasks.map((task, index) => {
                  const nodeWidth = 280;
                  const nodeHeight = 140;
                  const nodeSpacing = 60;
                  const x = 40 + index * (nodeWidth + nodeSpacing);
                  const y = 40;
                  const duration = parseDuration(task.duration);

                  // Draw connection line from previous node
                  const connection = index > 0 ? (
                    <g key={`conn-${index}`}>
                      <line
                        x1={x - nodeSpacing + 5}
                        y1={y + nodeHeight / 2}
                        x2={x - 5}
                        y2={y + nodeHeight / 2}
                        stroke="#e74c3c"
                        strokeWidth="3"
                        markerEnd="url(#arrowhead)"
                      />
                    </g>
                  ) : null;

                  return (
                    <g key={task.id}>
                      {connection}
                      {/* Main node rectangle */}
                      <rect
                        className="network-node"
                        x={x}
                        y={y}
                        width={nodeWidth}
                        height={nodeHeight}
                        rx="8"
                        fill="url(#nodeGradient)"
                        stroke="#e74c3c"
                        strokeWidth="3"
                      />

                      {/* Top row: ES | Duration | EF */}
                      <line x1={x} y1={y + 35} x2={x + nodeWidth} y2={y + 35} stroke="#e74c3c" strokeWidth="1" opacity="0.3" />
                      <line x1={x + nodeWidth/3} y1={y} x2={x + nodeWidth/3} y2={y + 35} stroke="#e74c3c" strokeWidth="1" opacity="0.3" />
                      <line x1={x + 2*nodeWidth/3} y1={y} x2={x + 2*nodeWidth/3} y2={y + 35} stroke="#e74c3c" strokeWidth="1" opacity="0.3" />

                      <text x={x + nodeWidth/6} y={y + 14} textAnchor="middle" fontSize="9" fill="#27ae60" fontWeight="600">ES</text>
                      <text x={x + nodeWidth/6} y={y + 28} textAnchor="middle" fontSize="11" fill="#27ae60" fontWeight="700">
                        {task.early_start !== undefined ? task.early_start.toFixed(1) : '—'}
                      </text>

                      <text x={x + nodeWidth/2} y={y + 14} textAnchor="middle" fontSize="9" fill="#3498db" fontWeight="600">DUR</text>
                      <text x={x + nodeWidth/2} y={y + 28} textAnchor="middle" fontSize="11" fill="#3498db" fontWeight="700">{duration}d</text>

                      <text x={x + 5*nodeWidth/6} y={y + 14} textAnchor="middle" fontSize="9" fill="#27ae60" fontWeight="600">EF</text>
                      <text x={x + 5*nodeWidth/6} y={y + 28} textAnchor="middle" fontSize="11" fill="#27ae60" fontWeight="700">
                        {task.early_finish !== undefined ? task.early_finish.toFixed(1) : '—'}
                      </text>

                      {/* Middle: Task Name and WBS */}
                      <text x={x + nodeWidth/2} y={y + 58} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#e74c3c">
                        {task.outline_number}
                      </text>
                      <text x={x + nodeWidth/2} y={y + 78} textAnchor="middle" fontSize="12" fontWeight="600" fill="#2c3e50">
                        {task.name.length > 28 ? task.name.substring(0, 28) + '...' : task.name}
                      </text>
                      <text x={x + nodeWidth/2} y={y + 95} textAnchor="middle" fontSize="10" fill="#7f8c8d">
                        Progress: {task.percent_complete}%
                      </text>

                      {/* Bottom row: LS | Float | LF */}
                      <line x1={x} y1={y + nodeHeight - 35} x2={x + nodeWidth} y2={y + nodeHeight - 35} stroke="#e74c3c" strokeWidth="1" opacity="0.3" />
                      <line x1={x + nodeWidth/3} y1={y + nodeHeight - 35} x2={x + nodeWidth/3} y2={y + nodeHeight} stroke="#e74c3c" strokeWidth="1" opacity="0.3" />
                      <line x1={x + 2*nodeWidth/3} y1={y + nodeHeight - 35} x2={x + 2*nodeWidth/3} y2={y + nodeHeight} stroke="#e74c3c" strokeWidth="1" opacity="0.3" />

                      <text x={x + nodeWidth/6} y={y + nodeHeight - 22} textAnchor="middle" fontSize="9" fill="#9b59b6" fontWeight="600">LS</text>
                      <text x={x + nodeWidth/6} y={y + nodeHeight - 8} textAnchor="middle" fontSize="11" fill="#9b59b6" fontWeight="700">
                        {task.late_start !== undefined ? task.late_start.toFixed(1) : '—'}
                      </text>

                      <text x={x + nodeWidth/2} y={y + nodeHeight - 22} textAnchor="middle" fontSize="9" fill="#e67e22" fontWeight="600">FLOAT</text>
                      <text x={x + nodeWidth/2} y={y + nodeHeight - 8} textAnchor="middle" fontSize="11" fill="#e67e22" fontWeight="700">
                        {(taskFloats[task.id] || 0).toFixed(1)}d
                      </text>

                      <text x={x + 5*nodeWidth/6} y={y + nodeHeight - 22} textAnchor="middle" fontSize="9" fill="#9b59b6" fontWeight="600">LF</text>
                      <text x={x + 5*nodeWidth/6} y={y + nodeHeight - 8} textAnchor="middle" fontSize="11" fill="#9b59b6" fontWeight="700">
                        {task.late_finish !== undefined ? task.late_finish.toFixed(1) : '—'}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="network-legend">
              <div className="legend-section">
                <span className="legend-title">Legend:</span>
                <span className="legend-item"><span className="legend-color" style={{background: '#27ae60'}}></span> ES/EF = Early Start/Finish</span>
                <span className="legend-item"><span className="legend-color" style={{background: '#9b59b6'}}></span> LS/LF = Late Start/Finish</span>
                <span className="legend-item"><span className="legend-color" style={{background: '#e67e22'}}></span> Float = Slack Time</span>
                <span className="legend-item"><span className="legend-color" style={{background: '#3498db'}}></span> DUR = Duration</span>
              </div>
            </div>
          </div>
        )}

        {activeView === 'table' && (
          <div className="table-view">
            <table className="critical-path-table">
              <thead>
                <tr>
                  <th>WBS</th>
                  <th>Task Name</th>
                  <th>Duration</th>
                  <th>Start Date</th>
                  <th>Finish Date</th>
                  <th>Float</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map((task) => (
                  <tr key={task.id}>
                    <td className="wbs-cell">{task.outline_number}</td>
                    <td className="task-name-cell">{task.name}</td>
                    <td>{formatDuration(task.duration)}</td>
                    <td>{dayToDate(task.early_start)}</td>
                    <td>{dayToDate(task.early_finish)}</td>
                    <td className="float-cell">{(taskFloats[task.id] || 0).toFixed(1)}d</td>
                    <td>
                      <div className="progress-cell">
                        <div className="progress-bar-mini" style={{ width: `${task.percent_complete}%` }} />
                        <span>{task.percent_complete}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

