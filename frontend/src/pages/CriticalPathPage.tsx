import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../api/client';
import { Printer, FileText, Table as TableIcon, BarChart3, Network, ArrowLeft } from 'lucide-react';
import './CriticalPathPage.css';

interface CriticalPathPageProps {
  criticalTasks: Task[];
  projectDuration: number;
  taskFloats: Record<string, number>;
}

export const CriticalPathPage: React.FC<CriticalPathPageProps> = ({
  criticalTasks,
  projectDuration,
  taskFloats,
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
    const headers = ['WBS', 'Task Name', 'Duration', 'Float (days)', 'Progress (%)'];
    const rows = sortedTasks.map(task => [
      task.outline_number,
      task.name,
      formatDuration(task.duration),
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
      '',
      'CRITICAL TASKS:',
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
              <p>Sequential flow of critical tasks • {sortedTasks.length} critical tasks</p>
            </div>
            <div className="network-container">
              <svg className="network-svg" width={Math.max(1400, sortedTasks.length * 280)} height={Math.max(600, Math.ceil(sortedTasks.length / 4) * 150 + 100)}>
                <defs>
                  <marker
                    id="arrowhead"
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3, 0 6" fill="#e74c3c" />
                  </marker>
                </defs>

                {sortedTasks.map((task, index) => {
                  const x = 80 + (index % 4) * 320;
                  const y = 60 + Math.floor(index / 4) * 180;
                  const duration = parseDuration(task.duration);

                  // Only draw connection to previous critical task in sequence
                  const connection = index > 0 ? (() => {
                    const prevIndex = index - 1;
                    const prevX = 80 + (prevIndex % 4) * 320;
                    const prevY = 60 + Math.floor(prevIndex / 4) * 180;

                    return (
                      <line
                        key={`conn-${index}`}
                        x1={prevX + 120}
                        y1={prevY + 40}
                        x2={x}
                        y2={y + 40}
                        stroke="#e74c3c"
                        strokeWidth="3"
                        markerEnd="url(#arrowhead)"
                        opacity="0.7"
                      />
                    );
                  })() : null;

                  return (
                    <g key={task.id}>
                      {connection}
                      <rect
                        className="network-node"
                        x={x}
                        y={y}
                        width="240"
                        height="80"
                        rx="8"
                        fill="white"
                        stroke="#e74c3c"
                        strokeWidth="3"
                      />
                      <text x={x + 120} y={y + 25} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#e74c3c">
                        {task.outline_number}
                      </text>
                      <text x={x + 120} y={y + 45} textAnchor="middle" fontSize="13" fontWeight="600" fill="#2c3e50">
                        {task.name.length > 25 ? task.name.substring(0, 25) + '...' : task.name}
                      </text>
                      <text x={x + 120} y={y + 65} textAnchor="middle" fontSize="11" fill="#7f8c8d">
                        {duration}d • {task.percent_complete}%
                      </text>
                    </g>
                  );
                })}
              </svg>
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
                  <th>Float</th>
                  <th>Progress</th>
                  <th>Start Date</th>
                  <th>Finish Date</th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map((task) => (
                  <tr key={task.id}>
                    <td className="wbs-cell">{task.outline_number}</td>
                    <td className="task-name-cell">{task.name}</td>
                    <td>{formatDuration(task.duration)}</td>
                    <td className="float-cell">{(taskFloats[task.id] || 0).toFixed(1)}d</td>
                    <td>
                      <div className="progress-cell">
                        <div className="progress-bar-mini" style={{ width: `${task.percent_complete}%` }} />
                        <span>{task.percent_complete}%</span>
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
    </div>
  );
};

