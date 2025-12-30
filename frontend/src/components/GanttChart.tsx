import React, { useMemo, useState, useRef, useCallback } from 'react';
import type { Task, CriticalPathResult } from '../api/client';
import { getCriticalPath } from '../api/client';
import { format, parseISO, addDays, differenceInDays, startOfWeek, addWeeks, addMonths, startOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronRight, ChevronDown, Diamond, ZoomIn, ZoomOut, Calendar, SkipForward, GitBranch, ChevronsDownUp, ChevronsUpDown, Filter } from 'lucide-react';

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
  const [isLoadingCriticalPath, setIsLoadingCriticalPath] = useState<boolean>(false);
  const [showCriticalPath, setShowCriticalPath] = useState<boolean>(false);
  const [criticalTaskIds, setCriticalTaskIds] = useState<Set<string>>(new Set());
  const [criticalPathData, setCriticalPathData] = useState<CriticalPathResult | null>(null);
  const [showBaselines, setShowBaselines] = useState<boolean>(true);
  const [selectedBaselineNumber, setSelectedBaselineNumber] = useState<number>(0);
  const [summaryFilter, setSummaryFilter] = useState<string>('all'); // 'all' or outline_number of summary task

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

  // Toggle critical path highlighting on the Gantt chart (MS Project style)
  const handleToggleCriticalPath = async () => {
    if (showCriticalPath) {
      // Turn off critical path highlighting
      setShowCriticalPath(false);
      setCriticalTaskIds(new Set());
      setCriticalPathData(null);
    } else {
      // Turn on critical path highlighting
      setIsLoadingCriticalPath(true);
      try {
        const result = await getCriticalPath();
        setCriticalPathData(result);
        // Create a Set of critical task IDs for fast lookup
        const criticalIds = new Set(result.critical_task_ids || []);
        setCriticalTaskIds(criticalIds);
        setShowCriticalPath(true);
        // Also store in sessionStorage for the detailed view tab
        sessionStorage.setItem('criticalPathData', JSON.stringify({
          ...result,
          projectStartDate: projectStartDate
        }));
      } catch (error) {
        console.error('Failed to calculate critical path:', error);
        alert('Failed to calculate critical path. Please try again.');
      } finally {
        setIsLoadingCriticalPath(false);
      }
    }
  };

  // Open critical path detailed analysis in a new tab
  const handleOpenCriticalPathDetails = async () => {
    // If we already have the data, just open the tab
    if (criticalPathData) {
      window.open('/critical-path', '_blank');
    } else {
      // Fetch data first, then open
      setIsLoadingCriticalPath(true);
      try {
        const result = await getCriticalPath();
        sessionStorage.setItem('criticalPathData', JSON.stringify({
          ...result,
          projectStartDate: projectStartDate
        }));
        window.open('/critical-path', '_blank');
      } catch (error) {
        console.error('Failed to calculate critical path:', error);
        alert('Failed to calculate critical path. Please try again.');
      } finally {
        setIsLoadingCriticalPath(false);
      }
    }
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

  // Create a map of outline_number to permanent row number (1-based)
  const taskRowNumbers = useMemo(() => {
    const rowMap = new Map<string, number>();
    let rowNumber = 1;
    sortedTasks.forEach((task) => {
      // Skip the main project task (outline "0")
      if (task.outline_number !== '0') {
        rowMap.set(task.outline_number, rowNumber);
        rowNumber++;
      }
    });
    return rowMap;
  }, [sortedTasks]);

  // Get top-level summary tasks for the filter dropdown
  const summaryTaskOptions = useMemo(() => {
    return sortedTasks.filter(task =>
      task.summary &&
      task.outline_number !== '0' &&
      !task.outline_number.includes('.') // Only top-level (e.g., "1", "2", "3")
    );
  }, [sortedTasks]);

  // Filter visible tasks based on expand/collapse state and summary filter
  const visibleTasks = useMemo(() => {
    const visible: Task[] = [];
    const collapsedParents = new Set<string>();

    sortedTasks.forEach(task => {
      const outline = task.outline_number;

      // Skip the main project task (outline "0") to avoid duplicates
      if (outline === '0') {
        return;
      }

      // Apply summary filter - show only tasks under selected summary
      if (summaryFilter !== 'all') {
        // Task must be the selected summary or a child of it
        if (outline !== summaryFilter && !outline.startsWith(summaryFilter + '.')) {
          return;
        }
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
  }, [sortedTasks, expandedTasks, summaryFilter]);

  // Format predecessors for display (MS Project style)
  const formatPredecessors = useCallback((predecessors: Task['predecessors']): string => {
    if (!predecessors || predecessors.length === 0) return '-';

    try {
      return predecessors.map(pred => {
        // Get the permanent row number for this predecessor
        const taskNumber = taskRowNumbers.get(pred.outline_number);

        if (!taskNumber) {
          // Task doesn't exist - broken reference
          console.warn(`⚠️ Broken predecessor reference: ${pred.outline_number} (task does not exist)`);
          return `❌${pred.outline_number}`;
        }

        // Dependency type mapping
        const typeMap: { [key: number]: string } = {
          0: 'FF', // Finish-to-Finish
          1: 'FS', // Finish-to-Start (default)
          2: 'SF', // Start-to-Finish
          3: 'SS', // Start-to-Start
        };

        // MS Project lag format:
        // 3 = minutes, 4 = elapsed minutes, 5 = hours, 6 = elapsed hours
        // 7 = days, 8 = elapsed days, 9 = weeks, 10 = elapsed weeks
        // 11 = months, 12 = elapsed months, 19 = percent
        const lagValue = pred.lag || 0;
        const lagFormat = pred.lag_format || 7;

        let lagDays = 0;
        if (lagFormat === 3) {
          // Minutes
          lagDays = lagValue / 480; // 8 hours * 60 minutes
        } else if (lagFormat === 5 || lagFormat === 6) {
          // Hours or elapsed hours
          lagDays = lagValue / 8;
        } else if (lagFormat === 7 || lagFormat === 8) {
          // Days or elapsed days (most common)
          lagDays = lagValue;
        } else if (lagFormat === 9 || lagFormat === 10) {
          // Weeks or elapsed weeks
          lagDays = lagValue * 5; // 5 working days per week
        } else if (lagFormat === 11 || lagFormat === 12) {
          // Months or elapsed months
          lagDays = lagValue * 20; // Approximate: 20 working days per month
        } else {
          // Default to days
          lagDays = lagValue;
        }

        // Start with task number
        let result = `${taskNumber}`;

        // Add dependency type
        // MS Project rule: Show type if NOT FS, OR if FS with lag
        const type = typeMap[pred.type] || 'FS';
        const hasLag = lagDays !== 0;

        if (pred.type !== 1 || hasLag) {
          // Show type if: not FS, or FS with lag
          result += type;
        }

        // Add lag if non-zero
        if (hasLag) {
          const sign = lagDays > 0 ? '+' : '';
          // Format lag: "10 days" or "1 day" or "2.5 days"
          const lagStr = lagDays % 1 === 0 ? lagDays.toString() : lagDays.toFixed(1);
          const dayLabel = Math.abs(lagDays) === 1 ? 'day' : 'days';
          result += `${sign}${lagStr} ${dayLabel}`;

          // Flag unreasonable lag values (>2 years)
          if (Math.abs(lagDays) > 730) {
            result += ' ⚠️';
          }
        }

        return result;
      }).join(',');
    } catch (error) {
      console.error('Error formatting predecessors:', error, predecessors);
      return '-';
    }
  }, [taskRowNumbers]);

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
            // MS Project stores lag in tenths of minutes
            // Convert: tenths of minutes -> minutes -> days
            const lagMinutes = (pred.lag || 0) / 10;
            const lagDays = lagMinutes / 480;
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

  const expandAll = useCallback(() => {
    const allSummaryIds = new Set<string>();
    tasks.forEach(task => {
      if (task.summary) {
        allSummaryIds.add(task.id);
      }
    });
    setExpandedTasks(allSummaryIds);
  }, [tasks]);

  const collapseAll = useCallback(() => {
    setExpandedTasks(new Set());
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
    
    // Reset the flag after a small delay to ensure the sync operation completes
    setTimeout(() => {
      skipSyncRef.current.timeline = false;
    }, 0);
  }, []);

  const handleTimelineScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (!taskListRef.current || skipSyncRef.current.timeline) {
      skipSyncRef.current.timeline = false;
      return;
    }
    
    // Only sync vertical scrolling, leave horizontal scrolling independent
    skipSyncRef.current.taskList = true;
    taskListRef.current.scrollTop = e.currentTarget.scrollTop;
    
    // Reset the flag after a small delay to ensure the sync operation completes
    setTimeout(() => {
      skipSyncRef.current.taskList = false;
    }, 0);
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
          <button
            className={`critical-path-button ${showCriticalPath ? 'active' : ''}`}
            onClick={handleToggleCriticalPath}
            disabled={isLoadingCriticalPath}
            title={showCriticalPath ? 'Hide Critical Path' : 'Show Critical Path'}
          >
            <GitBranch size={16} />
            {isLoadingCriticalPath ? 'Calculating...' : showCriticalPath ? 'Hide Critical Path' : 'Critical Path'}
          </button>
          {showCriticalPath && (
            <button
              className="critical-path-details-button"
              onClick={handleOpenCriticalPathDetails}
              title="Open Critical Path Details in New Tab"
            >
              Details
            </button>
          )}
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

            <button
              className={`control-button ${showBaselines ? 'active' : ''}`}
              onClick={() => setShowBaselines(!showBaselines)}
              title={showBaselines ? 'Hide Baselines' : 'Show Baselines'}
            >
              <GitBranch size={16} />
              {showBaselines ? 'Hide' : 'Show'} Baselines
            </button>

            {showBaselines && (
              <select
                className="baseline-select"
                value={selectedBaselineNumber}
                onChange={(e) => setSelectedBaselineNumber(parseInt(e.target.value))}
                title="Select Baseline"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                  <option key={num} value={num}>
                    Baseline {num}
                  </option>
                ))}
              </select>
            )}

            <button
              className="control-button"
              onClick={expandAll}
              title="Expand All Tasks"
            >
              <ChevronsUpDown size={16} />
              Expand All
            </button>

            <button
              className="control-button"
              onClick={collapseAll}
              title="Collapse All Tasks"
            >
              <ChevronsDownUp size={16} />
              Collapse All
            </button>

            <div className="summary-filter-control">
              <Filter size={16} />
              <select
                className="summary-filter-select"
                value={summaryFilter}
                onChange={(e) => setSummaryFilter(e.target.value)}
                title="Filter by Summary Task"
              >
                <option value="all">All Tasks</option>
                {summaryTaskOptions.map(task => (
                  <option key={task.id} value={task.outline_number}>
                    {task.outline_number} - {task.name}
                  </option>
                ))}
              </select>
            </div>
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
            <div className="gantt-header-cell">Finish Date</div>
            <div className="gantt-header-cell">Predecessors</div>
          </div>
          <div className="gantt-tasks" ref={taskListRef} onScroll={handleTaskListScroll}>
            {visibleTasks.map((task, index) => {
              const taskPos = taskPositions.find(p => p.task.id === task.id);
              const calculatedStartDate = taskPos?.startDate;
              // Get the permanent row number for this task
              const rowNumber = taskRowNumbers.get(task.outline_number) || index + 1;

              const isCritical = showCriticalPath && criticalTaskIds.has(task.id);

              return (
                <div
                  key={task.id}
                  className={`gantt-task-row ${task.summary ? 'summary' : ''} ${task.milestone ? 'milestone-row' : ''} ${isCritical ? 'critical-path' : ''}`}
                  onClick={() => onTaskClick(task)}
                >
                  <div className="gantt-task-number">
                    {rowNumber}
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
                  <div className="gantt-task-finish">
                    {calculatedStartDate ? (() => {
                      const duration = task.summary ? calculateSummaryDuration(task) : parseDuration(task.duration);
                      const finishDate = addDays(calculatedStartDate, duration);
                      return formatDate(finishDate.toISOString());
                    })() : '-'}
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
              {/* Arrow marker definitions */}
              <defs>
                {/* Normal arrow (gray) */}
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <polygon
                    points="0,0 8,3 0,6"
                    fill="#5a6c7d"
                  />
                </marker>
                {/* Critical path arrow (red) */}
                <marker
                  id="arrowhead-critical"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <polygon
                    points="0,0 8,3 0,6"
                    fill="#e74c3c"
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

                  // Check if this is a critical path dependency
                  const isCriticalDep = showCriticalPath && criticalTaskIds.has(task.id) && criticalTaskIds.has(predTaskPos.task.id);

                  // Calculate bar positions
                  const predEndX = ((predTaskPos.startDay + predTaskPos.duration) / maxDay) * timelineConfig.width;
                  const predY = (predTaskIndex * 48) + 24; // Center of predecessor row

                  const taskStartX = (startDay / maxDay) * timelineConfig.width;
                  const taskY = (taskIndex * 48) + 24; // Center of successor row

                  // Routing parameters
                  const exitGap = 4;      // Gap when leaving predecessor bar
                  const entryGap = 2;     // Small gap before arrow touches successor bar
                  const minHorizontalGap = 20;
                  const verticalPadding = 18;

                  // Start point: exit from predecessor bar end with small gap
                  const startX = predEndX + exitGap;
                  // End point: where arrow tip will touch successor bar
                  const endX = taskStartX - entryGap;

                  // Dependency type and lag
                  const lagDays = pred.lag || 0;

                  // Build path segments
                  let pathSegments: string[] = [];

                  if (endX > startX + minHorizontalGap) {
                    // Simple case: successor bar is to the right with enough space
                    const midX = startX + Math.min(20, (endX - startX) * 0.4);
                    pathSegments = [
                      `M ${predEndX} ${predY}`,  // Start at bar end
                      `H ${midX}`,                // Horizontal out
                      `V ${taskY}`,               // Vertical to successor level
                      `H ${endX}`                 // Horizontal to successor
                    ];
                  } else {
                    // Complex case: need to route around
                    const routeX1 = predEndX + exitGap + 8;
                    const routeX2 = taskStartX - entryGap - 8;

                    // Route above or below based on relative positions
                    const routeAbove = predY > taskY;
                    const clearanceY = routeAbove
                      ? Math.min(predY, taskY) - verticalPadding
                      : Math.max(predY, taskY) + verticalPadding;

                    pathSegments = [
                      `M ${predEndX} ${predY}`,   // Start at bar end
                      `H ${routeX1}`,              // Go right from predecessor
                      `V ${clearanceY}`,           // Go to clearance level
                      `H ${routeX2}`,              // Go horizontally
                      `V ${taskY}`,                // Go to successor level
                      `H ${endX}`                  // Go to successor start
                    ];
                  }

                  const pathD = pathSegments.join(' ');

                  // Tooltip
                  const depTypeLabel = pred.type === 1 ? 'FS' : pred.type === 2 ? 'SS' : pred.type === 3 ? 'FF' : 'SF';
                  const lagText = lagDays !== 0 ? ` ${lagDays > 0 ? '+' : ''}${lagDays}d` : '';
                  const tooltipText = `${predTaskPos.task.name} → ${task.name}\n${depTypeLabel}${lagText}`;

                  return (
                    <g key={`${task.id}-${pred.outline_number}-${predIndex}`}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke={isCriticalDep ? "#e74c3c" : "#5a6c7d"}
                        strokeWidth={isCriticalDep ? "2" : "1.5"}
                        markerEnd={isCriticalDep ? "url(#arrowhead-critical)" : "url(#arrowhead)"}
                        style={{ strokeLinejoin: 'round' }}
                      >
                        <title>{tooltipText}</title>
                      </path>

                      {/* Lag indicator if present */}
                      {lagDays !== 0 && (
                        <text
                          x={(predEndX + taskStartX) / 2}
                          y={predY < taskY ? (predY + taskY) / 2 - 6 : (predY + taskY) / 2 + 14}
                          fontSize="9"
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
              const isCriticalTask = showCriticalPath && criticalTaskIds.has(task.id);

              // Calculate baseline bar position if baseline exists
              const baseline = task.baselines?.find(b => b.number === selectedBaselineNumber);
              let baselineLeftPx = 0;
              let baselineWidthPx = 0;
              let hasBaseline = false;

              if (showBaselines && baseline && baseline.start && !task.milestone) {
                const baselineStartDate = parseISO(baseline.start);
                const baselineStartDay = differenceInDays(baselineStartDate, parseISO(projectStartDate)) + TIMELINE_OFFSET_DAYS;

                // Parse baseline duration
                let baselineDuration = 1;
                if (baseline.duration) {
                  const match = baseline.duration.match(/PT(\d+)H/);
                  if (match) {
                    baselineDuration = parseInt(match[1]) / 8;
                  }
                }

                baselineLeftPx = (baselineStartDay / maxDay) * timelineConfig.width;
                baselineWidthPx = (baselineDuration / maxDay) * timelineConfig.width;
                hasBaseline = true;
              }

              return (
                <div key={task.id} className="gantt-timeline-row">
                  {/* Baseline bar (shown below the current bar) */}
                  {hasBaseline && (
                    <div
                      className="gantt-bar baseline"
                      style={{
                        left: `${baselineLeftPx}px`,
                        width: `${baselineWidthPx}px`,
                      }}
                      title={`Baseline ${selectedBaselineNumber}: ${baseline?.start ? formatDate(baseline.start) : 'N/A'}`}
                    />
                  )}

                  {/* Current task bar */}
                  <div
                    className={`gantt-bar ${
                      task.milestone ? 'milestone' : ''
                    } ${
                      task.summary ? 'summary' : ''
                    } ${
                      isOverdue ? 'overdue' : ''
                    } ${
                      isUpcoming ? 'upcoming' : ''
                    } ${
                      hasBaseline ? 'has-baseline' : ''
                    } ${
                      isCriticalTask ? 'critical-path' : ''
                    }`}
                    style={{
                      left: `${leftPx}px`,
                      width: `${widthPx}px`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskEdit(task);
                    }}
                    title={`${task.name}\nStart: ${formatDate(startDate.toISOString())}\nDuration: ${duration} days${!task.milestone ? `\nProgress: ${progressPct}%` : ''}${hasBaseline ? `\nBaseline ${selectedBaselineNumber}: ${baseline?.start ? formatDate(baseline.start) : 'N/A'}` : ''}`}
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

