import React, { useMemo, useState, useRef, useCallback } from 'react';
import type { Task } from '../api/client';
import { format, parseISO, addDays, differenceInDays, startOfWeek, addWeeks, addMonths, startOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronRight, ChevronDown, Diamond, ZoomIn, ZoomOut, Calendar, SkipForward } from 'lucide-react';

interface GanttChartProps {
  tasks: Task[];
  projectStartDate: string;
  onTaskClick: (task: Task) => void;
  onTaskEdit: (task: Task) => void;
}

type ZoomLevel = 'day' | 'week' | 'month';

const ZOOM_CONFIG = {
  day: { width: 40, label: 'Daily' },
  week: { width: 280, label: 'Weekly' }, // 7 days * 40px
  month: { width: 120, label: 'Monthly' }
};

// Timeline offset in days (adds empty space before the first task)
const TIMELINE_OFFSET_DAYS = 14; // 2 weeks offset

export const GanttChart: React.FC<GanttChartProps> = ({
  tasks,
  projectStartDate,
  onTaskClick,
  onTaskEdit,
}) => {
  // Start with all summary tasks expanded by default
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => {
    const summaryTaskIds = new Set<string>();
    tasks.forEach(task => {
      if (task.summary) {
        summaryTaskIds.add(task.id);
      }
    });
    return summaryTaskIds;
  });

  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');
  const [showWeekends, setShowWeekends] = useState<boolean>(true);

  // Refs for synchronized scrolling
  const taskListRef = useRef<HTMLDivElement>(null);
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const skipSyncRef = useRef<{ taskList: boolean; timeline: boolean }>({ 
    taskList: false, 
    timeline: false 
  });

  // Parse duration from ISO 8601 format (PT8H0M0S) to days
  const parseDuration = (duration: string): number => {
    const match = duration.match(/PT(\d+)H/);
    if (match) {
      const hours = parseInt(match[1]);
      return hours / 8; // Convert hours to days (8-hour workday)
    }
    return 1;
  };

  // Format duration for display
  const formatDuration = (duration: string): string => {
    const days = parseDuration(duration);
    if (days === 0) return '0 days';
    if (days === 1) return '1 day';
    if (days % 1 === 0) return `${days} days`;
    return `${days} days`;
  };

  // Format predecessors for display (MS Project style)
  const formatPredecessors = (predecessors: Task['predecessors']): string => {
    if (!predecessors || predecessors.length === 0) return '';

    return predecessors.map(pred => {
      // Dependency type mapping
      const typeMap: { [key: number]: string } = {
        0: 'FF', // Finish-to-Finish
        1: 'FS', // Finish-to-Start (default)
        2: 'SF', // Start-to-Finish
        3: 'SS', // Start-to-Start
      };

      const type = typeMap[pred.type] || 'FS';

      // Convert lag from minutes to days (480 min = 1 day)
      const lagDays = (pred.lag || 0) / 480;

      // Format: "1.2FS" or "1.2FS+5d" or "1.2FS-3d"
      let result = pred.outline_number;

      // Only show type if not default FS
      if (pred.type !== 1) {
        result += type;
      } else {
        result += type; // Always show type for clarity
      }

      // Add lag if non-zero
      if (lagDays !== 0) {
        const sign = lagDays > 0 ? '+' : '';
        result += `${sign}${lagDays}d`;
      }

      return result;
    }).join(', ');
  };

  // Sort tasks by outline number to maintain hierarchy
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aParts = a.outline_number.split('.').map(Number);
      const bParts = b.outline_number.split('.').map(Number);

      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal !== bVal) return aVal - bVal;
      }
      return 0;
    });
  }, [tasks]);

  // Filter visible tasks based on expand/collapse state
  const visibleTasks = useMemo(() => {
    const visible: Task[] = [];
    const collapsedParents = new Set<string>();

    sortedTasks.forEach(task => {
      const outline = task.outline_number;
      
      // Skip the main project task (outline "0") to avoid duplicates
      if (outline === '0') {
        return;
      }

      // Check if any parent is collapsed
      let isHidden = false;
      for (const collapsedOutline of collapsedParents) {
        if (outline.startsWith(collapsedOutline + '.')) {
          isHidden = true;
          break;
        }
      }

      if (!isHidden) {
        visible.push(task);

        // If this summary task is collapsed, track it
        if (task.summary && !expandedTasks.has(task.id)) {
          collapsedParents.add(outline);
        }
      }
    });

    return visible;
  }, [sortedTasks, expandedTasks]);


  const calculateTaskDates = useMemo(() => {
    if (!projectStartDate) return new Map<string, Date>();

    const startDate = parseISO(projectStartDate);
    const taskDates = new Map<string, Date>();

    // Sort tasks by outline number to process in order
    const sortedForCalc = [...tasks].sort((a, b) => {
      const aParts = a.outline_number.split('.').map(Number);
      const bParts = b.outline_number.split('.').map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal !== bVal) return aVal - bVal;
      }
      return 0;
    });

    sortedForCalc.forEach(task => {
      let taskStartDate = startDate;

      // If task has predecessors, calculate start based on them
      if (task.predecessors && task.predecessors.length > 0) {
        let latestPredecessorEnd = startDate;

        task.predecessors.forEach(pred => {
          const predTask = tasks.find(t => t.outline_number === pred.outline_number);
          if (predTask) {
            const predStart = taskDates.get(predTask.id) || startDate;
            const predDuration = parseDuration(predTask.duration);
            const predEnd = addDays(predStart, predDuration);

            // Add lag if specified
            const lagDays = pred.lag || 0;
            const predEndWithLag = addDays(predEnd, lagDays);

            if (predEndWithLag > latestPredecessorEnd) {
              latestPredecessorEnd = predEndWithLag;
            }
          }
        });

        taskStartDate = latestPredecessorEnd;
      }

      taskDates.set(task.id, taskStartDate);
    });

    return taskDates;
  }, [tasks, projectStartDate]);

  // Calculate task positions
  const taskPositions = useMemo(() => {
    if (!projectStartDate) return [];

    const startDate = parseISO(projectStartDate);

    return visibleTasks.map((task) => {
      const duration = parseDuration(task.duration);
      const taskStart = calculateTaskDates.get(task.id) || startDate;
      const dayOffset = differenceInDays(taskStart, startDate);

      return {
        task,
        startDay: dayOffset + TIMELINE_OFFSET_DAYS, // Add offset to position tasks
        duration,
        endDay: dayOffset + duration + TIMELINE_OFFSET_DAYS, // Add offset to end position
        startDate: taskStart,
      };
    });
  }, [visibleTasks, projectStartDate, calculateTaskDates]);

  // Calculate chart dimensions
  const maxDay = useMemo(() => {
    return Math.max(...taskPositions.map((p) => p.endDay), 30);
  }, [taskPositions]);

  // Calculate timeline dimensions based on zoom level
  const timelineConfig = useMemo(() => {
    if (!projectStartDate) return { width: 1200, days: 30 };

    const config = ZOOM_CONFIG[zoomLevel];
    
    let timelineWidth: number;
    let totalDays = maxDay;
    
    switch (zoomLevel) {
      case 'day':
        timelineWidth = maxDay * config.width;
        break;
      case 'week':
        const weeks = Math.ceil(maxDay / 7);
        timelineWidth = weeks * config.width;
        break;
      case 'month':
        const months = Math.ceil(maxDay / 30);
        timelineWidth = months * config.width;
        break;
      default:
        timelineWidth = 1200;
    }
    
    return { width: timelineWidth, days: totalDays };
  }, [projectStartDate, maxDay, zoomLevel]);

  // Generate timeline header units
  const timelineHeaders = useMemo(() => {
    if (!projectStartDate) return [];

    const projectStart = parseISO(projectStartDate);
    // Start timeline earlier to show offset
    const startDate = addDays(projectStart, -TIMELINE_OFFSET_DAYS);
    const endDate = addDays(projectStart, maxDay - TIMELINE_OFFSET_DAYS);
    const config = ZOOM_CONFIG[zoomLevel];
    const headers: { date: Date; label: string; width: number }[] = [];

    switch (zoomLevel) {
      case 'day': {
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        days.forEach(day => {
          const isWeekend = getDay(day) === 0 || getDay(day) === 6;
          if (showWeekends || !isWeekend) {
            headers.push({
              date: day,
              label: format(day, 'dd'),
              width: config.width
            });
          }
        });
        break;
      }
      case 'week': {
        let currentWeek = startOfWeek(startDate);
        while (currentWeek <= endDate) {
          headers.push({
            date: currentWeek,
            label: `Week ${format(currentWeek, 'w')}`,
            width: config.width
          });
          currentWeek = addWeeks(currentWeek, 1);
        }
        break;
      }
      case 'month': {
        let currentMonth = startOfMonth(startDate);
        while (currentMonth <= endDate) {
          headers.push({
            date: currentMonth,
            label: format(currentMonth, "MMM 'yy"),
            width: config.width
          });
          currentMonth = addMonths(currentMonth, 1);
        }
        break;
      }
    }
    
    return headers;
  }, [projectStartDate, maxDay, zoomLevel, showWeekends]);

  // Calculate summary task durations based on their children
  const calculateSummaryDuration = useCallback((summaryTask: Task): number => {
    // Find all child tasks (tasks that start with this summary's outline number)
    const childTasks = tasks.filter(t =>
      t.outline_number.startsWith(summaryTask.outline_number + '.') &&
      t.outline_number !== summaryTask.outline_number
    );

    if (childTasks.length === 0) return 0;

    // Calculate start and end dates for all children
    const childDates = childTasks.map(child => {
      const startDate = calculateTaskDates.get(child.id) || parseISO(projectStartDate);
      const duration = parseDuration(child.duration);
      const endDate = addDays(startDate, duration);
      return { startDate, endDate };
    });

    // Find earliest start and latest end
    const earliestStart = childDates.reduce((min, curr) =>
      curr.startDate < min ? curr.startDate : min, childDates[0].startDate);
    const latestEnd = childDates.reduce((max, curr) =>
      curr.endDate > max ? curr.endDate : max, childDates[0].endDate);

    // Calculate duration in days
    return differenceInDays(latestEnd, earliestStart);
  }, [tasks, calculateTaskDates, projectStartDate]);

  // Calculate project statistics
  const projectStats = useMemo(() => {
    const regularTasks = tasks.filter(t => !t.summary && !t.milestone);
    const milestones = tasks.filter(t => t.milestone);
    const summaryTasks = tasks.filter(t => t.summary);

    return {
      total: tasks.length,
      regular: regularTasks.length,
      milestones: milestones.length,
      summary: summaryTasks.length,
    };
  }, [tasks]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const toggleExpand = useCallback((taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    if (zoomLevel === 'month') setZoomLevel('week');
    else if (zoomLevel === 'week') setZoomLevel('day');
  }, [zoomLevel]);

  const handleZoomOut = useCallback(() => {
    if (zoomLevel === 'day') setZoomLevel('week');
    else if (zoomLevel === 'week') setZoomLevel('month');
  }, [zoomLevel]);

  const scrollToToday = useCallback(() => {
    if (!projectStartDate || !timelineBodyRef.current) return;
    const startDate = parseISO(projectStartDate);
    const today = new Date();
    const dayOffset = differenceInDays(today, startDate) + TIMELINE_OFFSET_DAYS;
    const config = ZOOM_CONFIG[zoomLevel];
    const scrollPosition = (dayOffset * config.width) / (zoomLevel === 'day' ? 1 : zoomLevel === 'week' ? 7 : 30);
    timelineBodyRef.current.scrollLeft = Math.max(0, scrollPosition - 200);
  }, [projectStartDate, zoomLevel]);

  // Synchronized scrolling between task list and timeline
  const handleTaskListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!timelineBodyRef.current || skipSyncRef.current.taskList) {
      skipSyncRef.current.taskList = false;
      return;
    }
    
    skipSyncRef.current.timeline = true;
    timelineBodyRef.current.scrollTop = e.currentTarget.scrollTop;
  }, []);

  const handleTimelineScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!taskListRef.current || skipSyncRef.current.timeline) {
      skipSyncRef.current.timeline = false;
      return;
    }
    
    // Only sync vertical scrolling, leave horizontal scrolling independent
    skipSyncRef.current.taskList = true;
    taskListRef.current.scrollTop = e.currentTarget.scrollTop;
  }, []);

  // Removed zoom controls - using fixed month width instead

  const getTaskIndent = (level: number) => level * 20;

  // Get today's date for marker
  const today = new Date();
  const todayOffset = differenceInDays(today, parseISO(projectStartDate)) + TIMELINE_OFFSET_DAYS;

  return (
    <div className="gantt-chart">
      {/* Enhanced Toolbar */}
      <div className="gantt-toolbar">
        <div className="gantt-stats">
          <span className="stat-item">
            <strong>{projectStats.total}</strong> Total Tasks
          </span>
          <span className="stat-item">
            <strong>{projectStats.regular}</strong> Regular
          </span>
          <span className="stat-item">
            <strong>{projectStats.summary}</strong> Summary
          </span>
          <span className="stat-item">
            <strong>{projectStats.milestones}</strong> Milestones
          </span>
        </div>
        
        <div className="gantt-controls">
          <div className="gantt-zoom-controls">
            <button
              className="zoom-button"
              onClick={handleZoomOut}
              disabled={zoomLevel === 'month'}
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="zoom-level">{ZOOM_CONFIG[zoomLevel].label}</span>
            <button
              className="zoom-button"
              onClick={handleZoomIn}
              disabled={zoomLevel === 'day'}
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
          </div>
          
          <div className="gantt-view-controls">
            <button
              className="control-button"
              onClick={() => setShowWeekends(!showWeekends)}
              title={showWeekends ? 'Hide Weekends' : 'Show Weekends'}
            >
              <Calendar size={16} />
              {showWeekends ? 'Hide' : 'Show'} Weekends
            </button>
            
            <button
              className="control-button"
              onClick={scrollToToday}
              title="Scroll to Today"
            >
              <SkipForward size={16} />
              Today
            </button>
          </div>
        </div>
      </div>

      <div className="gantt-container">
        {/* Task List */}
        <div className="gantt-task-list">
          <div className="gantt-header">
            <div className="gantt-header-cell">#</div>
            <div className="gantt-header-cell">WBS Code</div>
            <div className="gantt-header-cell">Task Name</div>
            <div className="gantt-header-cell">Start Date</div>
            <div className="gantt-header-cell">Duration</div>
            <div className="gantt-header-cell">Predecessors</div>
          </div>
          <div className="gantt-tasks" ref={taskListRef} onScroll={handleTaskListScroll}>
            {visibleTasks.map((task, index) => {
              const taskPos = taskPositions.find(p => p.task.id === task.id);
              const calculatedStartDate = taskPos?.startDate;

              return (
                <div
                  key={task.id}
                  className={`gantt-task-row ${task.summary ? 'summary' : ''} ${task.milestone ? 'milestone-row' : ''}`}
                  onClick={() => onTaskClick(task)}
                >
                  <div className="gantt-task-number">
                    {index + 1}
                  </div>
                  <div className="gantt-task-wbs">{task.outline_number}</div>
                  <div className="gantt-task-name" style={{ paddingLeft: getTaskIndent(task.outline_level) }}>
                    {task.summary ? (
                      <button
                        className="expand-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(task.id);
                        }}
                      >
                        {expandedTasks.has(task.id) ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>
                    ) : (
                      <span className="expand-button-spacer"></span>
                    )}
                    {task.milestone && <Diamond size={14} className="milestone-icon" />}
                    <span className="task-name-text">{task.name}</span>
                    {task.summary && <span className="summary-badge">Summary</span>}
                  </div>
                  <div className="gantt-task-start">
                    {calculatedStartDate ? formatDate(calculatedStartDate.toISOString()) : '-'}
                  </div>
                  <div className="gantt-task-duration">
                    {task.summary ? (() => {
                      const summaryDuration = calculateSummaryDuration(task);
                      return summaryDuration === 0 ? '0 days' :
                             summaryDuration === 1 ? '1 day' :
                             summaryDuration % 1 === 0 ? `${summaryDuration} days` :
                             `${summaryDuration.toFixed(1)} days`;
                    })() : formatDuration(task.duration)}
                  </div>
                  <div className="gantt-task-predecessors" title={formatPredecessors(task.predecessors)}>
                    {formatPredecessors(task.predecessors)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline */}
        <div className="gantt-timeline">
          <div className="gantt-timeline-header">
            {timelineHeaders.map((header, i) => {
              const isWeekend = zoomLevel === 'day' && (getDay(header.date) === 0 || getDay(header.date) === 6);
              return (
                <div
                  key={i}
                  className={`gantt-timeline-header-unit ${zoomLevel} ${isWeekend ? 'weekend' : ''}`}
                  style={{ minWidth: `${header.width}px`, width: `${header.width}px` }}
                >
                  <div className="timeline-label">{header.label}</div>
                  {zoomLevel === 'day' && (
                    <div className="day-name">{format(header.date, 'EEE')}</div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="gantt-timeline-body" ref={timelineBodyRef} onScroll={handleTimelineScroll}>
            <div className="gantt-timeline-content" style={{ width: `${timelineConfig.width}px` }}>
            {/* Today marker */}
            {todayOffset >= 0 && todayOffset <= maxDay && (
              <div
                className="today-marker"
                style={{ left: `${(todayOffset / maxDay) * timelineConfig.width}px` }}
              >
                <div className="today-label">Today</div>
              </div>
            )}

            {/* Weekend columns */}
            {showWeekends && Array.from({ length: maxDay }, (_, i) => {
              const date = addDays(parseISO(projectStartDate), i - TIMELINE_OFFSET_DAYS);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              const dayWidthPx = timelineConfig.width / maxDay;
              return isWeekend ? (
                <div
                  key={`weekend-${i}`}
                  className="weekend-column"
                  style={{
                    left: `${(i / maxDay) * timelineConfig.width}px`,
                    width: `${dayWidthPx}px`,
                  }}
                />
              ) : null;
            })}

            {/* Dependency lines */}
            <svg className="gantt-dependencies" style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${timelineConfig.width}px`,
              height: `${visibleTasks.length * 48}px`,
              pointerEvents: 'none',
              zIndex: 5,
              overflow: 'visible'
            }}>
              {/* Arrow marker definition - must be before usage */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="12"
                  markerHeight="10"
                  refX="11"
                  refY="5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon 
                    points="0,0 12,5 0,10" 
                    className="dependency-arrow"
                    fill="#2c3e50" 
                  />
                </marker>
              </defs>

              {taskPositions.map(({ task, startDay }, taskIndex) => {
                if (!task.predecessors || task.predecessors.length === 0) return null;

                return task.predecessors.map((pred, predIndex) => {
                  // Find predecessor task position in visible tasks
                  const predTaskPos = taskPositions.find(p => p.task.outline_number === pred.outline_number);

                  // If predecessor is not visible (hidden by collapsed parent), skip drawing this line
                  if (!predTaskPos) return null;

                  const predTaskIndex = taskPositions.findIndex(p => p.task.outline_number === pred.outline_number);
                  if (predTaskIndex === -1) return null;

                  // Enhanced MS Project style dependency routing
                  const predEndX = ((predTaskPos.startDay + predTaskPos.duration) / maxDay) * timelineConfig.width;
                  const predY = (predTaskIndex * 48) + 24; // Center of predecessor row

                  const taskStartX = (startDay / maxDay) * timelineConfig.width;
                  const taskY = (taskIndex * 48) + 24; // Center of successor row

                  // Enhanced routing parameters
                  const minHorizontalGap = 16;
                  const verticalPadding = 16;
                  const arrowSize = 6;

                  // Dependency type and styling
                  const lagDays = pred.lag || 0;
                  
                  // Calculate connection points based on dependency type
                  let startX = predEndX;
                  let endX = taskStartX - arrowSize;
                  
                  // Enhanced routing algorithm
                  let pathSegments: string[] = [];
                  
                  if (endX > startX + minHorizontalGap * 2) {
                    // Simple case: successor is well to the right
                    const midX = startX + (endX - startX) * 0.3; // Closer to predecessor for better visual
                    pathSegments = [
                      `M ${startX} ${predY}`,
                      `H ${midX}`, // Horizontal to intermediate point
                      `V ${taskY}`, // Vertical to successor level
                      `H ${endX}`   // Horizontal to successor
                    ];
                  } else {
                    // Complex case: route around tasks
                    const routeX1 = startX + minHorizontalGap;
                    const routeX2 = endX - minHorizontalGap;
                    
                    // Determine routing direction (above or below)
                    const routeAbove = predY > taskY;
                    const clearanceY = routeAbove 
                      ? Math.min(predY, taskY) - verticalPadding
                      : Math.max(predY, taskY) + verticalPadding;
                    
                    pathSegments = [
                      `M ${startX} ${predY}`,
                      `H ${routeX1}`,           // Go right from predecessor
                      `V ${clearanceY}`,        // Go to clearance level
                      `H ${routeX2}`,           // Go horizontally to above successor
                      `V ${taskY}`,             // Go down to successor level
                      `H ${endX}`               // Go to successor start
                    ];
                  }
                  
                  const pathD = pathSegments.join(' ');
                  
                  // Enhanced tooltip with more details
                  const depTypeLabel = pred.type === 1 ? 'FS' : pred.type === 2 ? 'SS' : pred.type === 3 ? 'FF' : 'SF';
                  const lagText = lagDays !== 0 ? ` ${lagDays > 0 ? '+' : ''}${lagDays}d` : '';
                  const tooltipText = `${predTaskPos.task.name} → ${task.name}\\n${depTypeLabel}${lagText}`;

                  return (
                    <g key={`${task.id}-${pred.outline_number}-${predIndex}`}>
                      {/* Enhanced path with better styling */}
                      <path
                        d={pathD}
                        markerEnd="url(#arrowhead)"
                        className="dependency-line"
                      >
                        <title>{tooltipText}</title>
                      </path>
                      
                      {/* Lag indicator if present */}
                      {lagDays !== 0 && (
                        <text
                          x={(startX + endX) / 2}
                          y={predY < taskY ? (predY + taskY) / 2 - 8 : (predY + taskY) / 2 + 16}
                          fontSize="10"
                          fill="#7f8c8d"
                          textAnchor="middle"
                          className="lag-label"
                        >
                          {lagDays > 0 ? `+${lagDays}d` : `${lagDays}d`}
                        </text>
                      )}
                    </g>
                  );
                });
              })}
            </svg>

            {/* Task bars */}
            {taskPositions.map(({ task, startDay, duration, startDate }) => {
              const leftPx = (startDay / maxDay) * timelineConfig.width;
              const widthPx = task.milestone ? 20 : (duration / maxDay) * timelineConfig.width;
              
              // Use actual percent complete from task data
              const progressPct = task.milestone ? 100 : (task.percent_complete || 0);
              
              const isOverdue = !task.milestone && !task.summary && startDate < new Date() && progressPct < 100;
              const isUpcoming = startDate > addDays(new Date(), 7);

              return (
                <div key={task.id} className="gantt-timeline-row">
                  <div
                    className={`gantt-bar ${
                      task.milestone ? 'milestone' : ''
                    } ${
                      task.summary ? 'summary' : ''
                    } ${
                      isOverdue ? 'overdue' : ''
                    } ${
                      isUpcoming ? 'upcoming' : ''
                    }`}
                    style={{
                      left: `${leftPx}px`,
                      width: `${widthPx}px`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskEdit(task);
                    }}
                    title={`${task.name}\nStart: ${formatDate(startDate.toISOString())}\nDuration: ${duration} days${!task.milestone ? `\nProgress: ${progressPct}%` : ''}`}
                  >
                    {!task.milestone && !task.summary && (
                      <div 
                        className="gantt-bar-progress" 
                        style={{ width: `${progressPct}%` }}
                      />
                    )}
                    {!task.milestone && widthPx > 60 && (
                      <span className="gantt-bar-label">
                        {task.name}
                        {!task.summary && (
                          <span className="progress-text"> ({progressPct}%)</span>
                        )}
                      </span>
                    )}
                    {task.milestone && (
                      <div className="milestone-marker" />
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

