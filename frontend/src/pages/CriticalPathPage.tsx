import { useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../api/client';
import { Printer, FileText, Table as TableIcon, BarChart3, Network, ArrowLeft, Diamond, ZoomIn, ZoomOut, Download, Image } from 'lucide-react';
import { parseISO, addDays, format, startOfMonth, addMonths, eachDayOfInterval, getDay } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './CriticalPathPage.css';
import '../ui-overrides.css';

interface CriticalPathPageProps {
  criticalTasks: Task[];
  projectDuration: number;
  taskFloats: Record<string, number>;
  projectStartDate?: string;
}

type ZoomLevel = 'day' | 'week' | 'month';

const ZOOM_CONFIG = {
  day: { width: 40, label: 'Daily' },
  week: { width: 280, label: 'Weekly' },
  month: { width: 120, label: 'Monthly' }
};

export const CriticalPathPage: React.FC<CriticalPathPageProps> = ({
  criticalTasks,
  projectDuration,
  taskFloats,
  projectStartDate,
}) => {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'outline' | 'duration' | 'float'>('outline');
  const [activeView, setActiveView] = useState<'table' | 'timeline' | 'network'>('timeline');
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('month');

  // Refs for synchronized scrolling and export
  const taskListRef = useRef<HTMLDivElement>(null);
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const ganttViewRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

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

  // Synchronized scrolling
  const handleTaskListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (timelineBodyRef.current) {
      timelineBodyRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (taskListRef.current) {
      taskListRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Calculate timeline configuration
  const timelineConfig = useMemo(() => {
    if (!projectStartDate || sortedTasks.length === 0) {
      return { startDate: new Date(), endDate: new Date(), width: 1000, maxDay: 30 };
    }

    const startDate = parseISO(projectStartDate);

    // Find the earliest and latest dates from critical tasks
    let minDay = Infinity;
    let maxDay = 0;

    sortedTasks.forEach(task => {
      const earlyStart = task.early_start ?? 0;
      const earlyFinish = task.early_finish ?? (earlyStart + parseDuration(task.duration));
      minDay = Math.min(minDay, earlyStart);
      maxDay = Math.max(maxDay, earlyFinish);
    });

    // Add padding
    minDay = Math.max(0, minDay - 7);
    maxDay = maxDay + 14;

    const totalDays = maxDay - minDay;
    const dayWidth = ZOOM_CONFIG[zoomLevel].width / (zoomLevel === 'week' ? 7 : zoomLevel === 'month' ? 30 : 1);
    const width = totalDays * dayWidth;

    return {
      startDate: addDays(startDate, minDay),
      endDate: addDays(startDate, maxDay),
      width: Math.max(width, 800),
      maxDay: totalDays,
      offsetDays: minDay
    };
  }, [projectStartDate, sortedTasks, zoomLevel]);

  // Generate timeline headers
  const timelineHeaders = useMemo(() => {
    if (!projectStartDate) return [];

    const headers: { date: Date; label: string; width: number }[] = [];
    const { startDate, endDate } = timelineConfig;

    if (zoomLevel === 'day') {
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      days.forEach(day => {
        headers.push({
          date: day,
          label: format(day, 'd'),
          width: ZOOM_CONFIG.day.width
        });
      });
    } else if (zoomLevel === 'week') {
      let current = startDate;
      while (current <= endDate) {
        headers.push({
          date: current,
          label: format(current, 'MMM d'),
          width: ZOOM_CONFIG.week.width
        });
        current = addDays(current, 7);
      }
    } else {
      let current = startOfMonth(startDate);
      while (current <= endDate) {
        headers.push({
          date: current,
          label: format(current, 'MMM yyyy'),
          width: ZOOM_CONFIG.month.width
        });
        current = addMonths(current, 1);
      }
    }

    return headers;
  }, [projectStartDate, timelineConfig, zoomLevel]);

  // Calculate bar positions for critical tasks
  const taskBarPositions = useMemo(() => {
    if (!projectStartDate) return [];

    const startDate = parseISO(projectStartDate);
    const offsetDays = (timelineConfig as any).offsetDays || 0;
    const dayWidth = timelineConfig.width / timelineConfig.maxDay;

    return sortedTasks.map(task => {
      const earlyStart = task.early_start ?? 0;
      const duration = parseDuration(task.duration);
      const earlyFinish = task.early_finish ?? (earlyStart + duration);

      const barStart = (earlyStart - offsetDays) * dayWidth;
      const barWidth = Math.max(duration * dayWidth, task.milestone ? 0 : 4);
      const taskStartDate = addDays(startDate, earlyStart);
      const taskEndDate = addDays(startDate, earlyFinish);

      return {
        task,
        barStart,
        barWidth,
        startDate: taskStartDate,
        endDate: taskEndDate
      };
    });
  }, [sortedTasks, projectStartDate, timelineConfig]);

  // Calculate dependency connections for drawing lines
  const dependencyConnections = useMemo(() => {
    const connections: {
      fromTaskId: string;
      toTaskId: string;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
    }[] = [];

    // Create a map of outline_number to task index for quick lookup
    const outlineToIndex = new Map<string, number>();
    sortedTasks.forEach((task, index) => {
      outlineToIndex.set(task.outline_number, index);
    });

    // For each task, find its predecessors and create connection lines
    taskBarPositions.forEach((pos, index) => {
      const task = pos.task;
      if (task.predecessors && task.predecessors.length > 0) {
        task.predecessors.forEach(pred => {
          const predIndex = outlineToIndex.get(pred.outline_number);
          if (predIndex !== undefined) {
            const predPos = taskBarPositions[predIndex];
            if (predPos) {
              // Calculate line coordinates
              // From: end of predecessor bar
              // To: start of current task bar
              const rowHeight = 40;
              const barVerticalCenter = 20; // Center of 40px row

              const fromX = predPos.barStart + predPos.barWidth;
              const fromY = predIndex * rowHeight + barVerticalCenter;
              const toX = pos.barStart;
              const toY = index * rowHeight + barVerticalCenter;

              connections.push({
                fromTaskId: predPos.task.id,
                toTaskId: task.id,
                fromX,
                fromY,
                toX,
                toY
              });
            }
          }
        });
      }
    });

    return connections;
  }, [sortedTasks, taskBarPositions]);

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

  // Export Gantt view as PDF - 11x17 Tabloid size with row-based pagination
  const handleExportGanttPDF = useCallback(async () => {
    if (!ganttViewRef.current || isExporting) return;

    setIsExporting(true);
    try {
      const ganttContainer = ganttViewRef.current;

      // Find elements
      const tableBody = ganttContainer.querySelector('.cp-gantt-table-body') as HTMLElement;
      const timelineBody = ganttContainer.querySelector('.cp-timeline-body') as HTMLElement;
      const ganttContainerEl = ganttContainer.querySelector('.cp-gantt-container') as HTMLElement;
      const ganttHeader = ganttContainer.querySelector('.gantt-view-header') as HTMLElement;
      const ganttLegend = ganttContainer.querySelector('.cp-legend') as HTMLElement;
      const tableHeader = ganttContainer.querySelector('.cp-gantt-table-header') as HTMLElement;
      // Store original styles
      const originalTableBodyStyle = tableBody?.style.cssText || '';
      const originalTimelineBodyStyle = timelineBody?.style.cssText || '';
      const originalGanttContainerStyle = ganttContainerEl?.style.cssText || '';
      const originalHeaderStyle = ganttHeader?.style.cssText || '';
      const originalLegendStyle = ganttLegend?.style.cssText || '';

      // Row height in the UI (40px per row)
      const ROW_HEIGHT = 40;
      const TABLE_HEADER_HEIGHT = tableHeader?.offsetHeight || 45;
      const CANVAS_SCALE = 2; // html2canvas scale factor

      // Calculate full content height
      const totalRows = taskBarPositions.length;
      const fullHeight = totalRows * ROW_HEIGHT + 100;

      // Temporarily expand to show all content
      if (tableBody) {
        tableBody.style.height = `${fullHeight}px`;
        tableBody.style.maxHeight = 'none';
        tableBody.style.overflow = 'visible';
      }
      if (timelineBody) {
        timelineBody.style.height = `${fullHeight}px`;
        timelineBody.style.maxHeight = 'none';
        timelineBody.style.overflow = 'visible';
      }
      if (ganttContainerEl) {
        ganttContainerEl.style.height = 'auto';
        ganttContainerEl.style.maxHeight = 'none';
        ganttContainerEl.style.overflow = 'visible';
      }
      // Hide the UI header and legend
      if (ganttHeader) ganttHeader.style.display = 'none';
      if (ganttLegend) ganttLegend.style.display = 'none';

      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture the full Gantt view
      const canvas = await html2canvas(ganttContainer, {
        scale: CANVAS_SCALE,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: ganttContainer.scrollWidth,
        windowHeight: ganttContainer.scrollHeight
      });

      // Restore original styles
      if (tableBody) tableBody.style.cssText = originalTableBodyStyle;
      if (timelineBody) timelineBody.style.cssText = originalTimelineBodyStyle;
      if (ganttContainerEl) ganttContainerEl.style.cssText = originalGanttContainerStyle;
      if (ganttHeader) ganttHeader.style.cssText = originalHeaderStyle;
      if (ganttLegend) ganttLegend.style.cssText = originalLegendStyle;

      // PDF dimensions - 11x17 Tabloid Landscape
      const pageWidth = 1224; // 17 inches in points
      const pageHeight = 792; // 11 inches in points
      const margin = 40;
      const pdfHeaderHeight = 70;
      const footerHeight = 25;
      const columnHeaderHeight = 35; // Space for repeated column headers

      // Calculate scale to fit width
      const contentWidth = pageWidth - (margin * 2);
      const scale = contentWidth / canvas.width;

      // Scaled row height and table header height
      const scaledRowHeight = ROW_HEIGHT * CANVAS_SCALE * scale;
      const scaledTableHeaderHeight = TABLE_HEADER_HEIGHT * CANVAS_SCALE * scale;

      // Available height for rows on each page
      const firstPageRowsHeight = pageHeight - pdfHeaderHeight - footerHeight - margin - scaledTableHeaderHeight;
      const subsequentPageRowsHeight = pageHeight - margin - footerHeight - columnHeaderHeight - scaledTableHeaderHeight;

      // Calculate rows per page
      const rowsOnFirstPage = Math.floor(firstPageRowsHeight / scaledRowHeight);
      const rowsOnSubsequentPage = Math.floor(subsequentPageRowsHeight / scaledRowHeight);

      // Calculate total pages needed
      let pagesNeeded = 1;
      let remainingRows = totalRows - rowsOnFirstPage;
      while (remainingRows > 0) {
        pagesNeeded++;
        remainingRows -= rowsOnSubsequentPage;
      }

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'tabloid'
      });

      // Extract the column header portion from canvas (first TABLE_HEADER_HEIGHT pixels)
      const headerCanvas = document.createElement('canvas');
      headerCanvas.width = canvas.width;
      headerCanvas.height = TABLE_HEADER_HEIGHT * CANVAS_SCALE;
      const headerCtx = headerCanvas.getContext('2d');
      if (headerCtx) {
        headerCtx.drawImage(
          canvas,
          0, 0, canvas.width, TABLE_HEADER_HEIGHT * CANVAS_SCALE,
          0, 0, canvas.width, TABLE_HEADER_HEIGHT * CANVAS_SCALE
        );
      }
      const columnHeaderImgData = headerCanvas.toDataURL('image/png');

      let currentRow = 0;

      for (let page = 0; page < pagesNeeded; page++) {
        if (page > 0) {
          pdf.addPage('tabloid', 'landscape');
        }

        let yPosition = margin;

        // Add PDF header on first page only
        if (page === 0) {
          pdf.setFontSize(18);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Critical Path Gantt Chart', margin, yPosition + 20);

          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100);
          pdf.text(`${sortedTasks.length} critical tasks • ${projectDuration.toFixed(1)} days total duration • Generated: ${format(new Date(), 'MMM d, yyyy')}`, margin, yPosition + 40);
          pdf.setTextColor(0);

          yPosition = pdfHeaderHeight;
        } else {
          // Add continuation indicator on subsequent pages
          pdf.setFontSize(9);
          pdf.setTextColor(128);
          pdf.text('(continued)', margin, yPosition + 15);
          pdf.setTextColor(0);
          yPosition = margin + columnHeaderHeight;
        }

        // Add column headers on every page
        pdf.addImage(
          columnHeaderImgData,
          'PNG',
          margin,
          yPosition,
          contentWidth,
          scaledTableHeaderHeight
        );
        yPosition += scaledTableHeaderHeight;

        // Calculate how many rows to include on this page
        const rowsThisPage = page === 0 ? rowsOnFirstPage : rowsOnSubsequentPage;
        const rowsToRender = Math.min(rowsThisPage, totalRows - currentRow);

        if (rowsToRender > 0) {
          // Extract the rows for this page from the canvas
          const sourceY = (TABLE_HEADER_HEIGHT + currentRow * ROW_HEIGHT) * CANVAS_SCALE;
          const sourceHeight = rowsToRender * ROW_HEIGHT * CANVAS_SCALE;

          const rowsCanvas = document.createElement('canvas');
          rowsCanvas.width = canvas.width;
          rowsCanvas.height = sourceHeight;
          const rowsCtx = rowsCanvas.getContext('2d');

          if (rowsCtx) {
            rowsCtx.drawImage(
              canvas,
              0, sourceY, canvas.width, sourceHeight,
              0, 0, canvas.width, sourceHeight
            );

            const rowsImgData = rowsCanvas.toDataURL('image/png');
            const scaledRowsHeight = sourceHeight * scale;

            pdf.addImage(
              rowsImgData,
              'PNG',
              margin,
              yPosition,
              contentWidth,
              scaledRowsHeight
            );
          }

          currentRow += rowsToRender;
        }

        // Add footer with page number
        pdf.setFontSize(9);
        pdf.setTextColor(128);
        pdf.text(
          `Page ${page + 1} of ${pagesNeeded}`,
          pageWidth / 2,
          pageHeight - 15,
          { align: 'center' }
        );
        pdf.setTextColor(0);
      }

      pdf.save(`critical-path-gantt-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, sortedTasks.length, projectDuration, taskBarPositions.length]);

  // Export Gantt view as PNG image (full chart)
  const handleExportGanttImage = useCallback(async () => {
    if (!ganttViewRef.current || isExporting) return;

    setIsExporting(true);
    try {
      const ganttContainer = ganttViewRef.current;

      // Find the scrollable containers and temporarily expand them
      const tableBody = ganttContainer.querySelector('.cp-gantt-table-body') as HTMLElement;
      const timelineBody = ganttContainer.querySelector('.cp-timeline-body') as HTMLElement;
      const ganttContainerEl = ganttContainer.querySelector('.cp-gantt-container') as HTMLElement;

      // Store original styles
      const originalTableBodyStyle = tableBody?.style.cssText || '';
      const originalTimelineBodyStyle = timelineBody?.style.cssText || '';
      const originalGanttContainerStyle = ganttContainerEl?.style.cssText || '';

      // Calculate full content height
      const fullHeight = Math.max(
        taskBarPositions.length * 40 + 100,
        500
      );

      // Temporarily expand to show all content
      if (tableBody) {
        tableBody.style.height = `${fullHeight}px`;
        tableBody.style.maxHeight = 'none';
        tableBody.style.overflow = 'visible';
      }
      if (timelineBody) {
        timelineBody.style.height = `${fullHeight}px`;
        timelineBody.style.maxHeight = 'none';
        timelineBody.style.overflow = 'visible';
      }
      if (ganttContainerEl) {
        ganttContainerEl.style.height = 'auto';
        ganttContainerEl.style.maxHeight = 'none';
        ganttContainerEl.style.overflow = 'visible';
      }

      // Wait for reflow
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(ganttContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: ganttContainer.scrollWidth,
        windowHeight: ganttContainer.scrollHeight
      });

      // Restore original styles
      if (tableBody) tableBody.style.cssText = originalTableBodyStyle;
      if (timelineBody) timelineBody.style.cssText = originalTimelineBodyStyle;
      if (ganttContainerEl) ganttContainerEl.style.cssText = originalGanttContainerStyle;

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `critical-path-gantt-${format(new Date(), 'yyyy-MM-dd')}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Error exporting image:', error);
      alert('Failed to export image. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, taskBarPositions.length]);

  return (
    <div className="critical-path-page">
      <div className="page-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate('/app')} title="Back to Project">
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
          <div className="gantt-view" ref={ganttViewRef}>
            <div className="gantt-view-header">
              <div className="gantt-view-title">
                <h2>Critical Path Gantt Chart</h2>
                <p>{sortedTasks.length} critical tasks • {projectDuration.toFixed(1)} days total</p>
              </div>
              <div className="gantt-view-controls">
                <button
                  className={`zoom-btn ${zoomLevel === 'day' ? 'active' : ''}`}
                  onClick={() => setZoomLevel('day')}
                  title="Daily view"
                >
                  <ZoomIn size={16} />
                  Day
                </button>
                <button
                  className={`zoom-btn ${zoomLevel === 'week' ? 'active' : ''}`}
                  onClick={() => setZoomLevel('week')}
                  title="Weekly view"
                >
                  Week
                </button>
                <button
                  className={`zoom-btn ${zoomLevel === 'month' ? 'active' : ''}`}
                  onClick={() => setZoomLevel('month')}
                  title="Monthly view"
                >
                  <ZoomOut size={16} />
                  Month
                </button>
                <div className="gantt-export-divider" />
                <button
                  className="zoom-btn export-btn"
                  onClick={handleExportGanttPDF}
                  disabled={isExporting}
                  title="Export as PDF"
                >
                  <Download size={16} />
                  PDF
                </button>
                <button
                  className="zoom-btn export-btn"
                  onClick={handleExportGanttImage}
                  disabled={isExporting}
                  title="Export as Image"
                >
                  <Image size={16} />
                  PNG
                </button>
              </div>
            </div>

            <div className="cp-gantt-container">
              {/* Task Table */}
              <div className="cp-gantt-table">
                <div className="cp-gantt-table-header">
                  <div className="cp-header-cell cp-cell-num">#</div>
                  <div className="cp-header-cell cp-cell-wbs">WBS</div>
                  <div className="cp-header-cell cp-cell-name">Task Name</div>
                  <div className="cp-header-cell cp-cell-dur">Duration</div>
                  <div className="cp-header-cell cp-cell-start">Start</div>
                  <div className="cp-header-cell cp-cell-finish">Finish</div>
                  <div className="cp-header-cell cp-cell-float">Float</div>
                </div>
                <div className="cp-gantt-table-body" ref={taskListRef} onScroll={handleTaskListScroll}>
                  {taskBarPositions.map((pos, index) => (
                    <div key={pos.task.id} className={`cp-task-row ${pos.task.milestone ? 'milestone' : ''}`}>
                      <div className="cp-cell cp-cell-num">{index + 1}</div>
                      <div className="cp-cell cp-cell-wbs">{pos.task.outline_number}</div>
                      <div className="cp-cell cp-cell-name" title={pos.task.name}>
                        {pos.task.milestone && <Diamond size={12} className="milestone-icon" />}
                        {pos.task.name}
                      </div>
                      <div className="cp-cell cp-cell-dur">{formatDuration(pos.task.duration)}</div>
                      <div className="cp-cell cp-cell-start">{format(pos.startDate, 'MMM d, yyyy')}</div>
                      <div className="cp-cell cp-cell-finish">{format(pos.endDate, 'MMM d, yyyy')}</div>
                      <div className="cp-cell cp-cell-float">{(taskFloats[pos.task.id] || 0).toFixed(1)}d</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gantt Timeline */}
              <div className="cp-gantt-timeline">
                <div className="cp-timeline-header">
                  {timelineHeaders.map((header, i) => {
                    const isWeekend = zoomLevel === 'day' && (getDay(header.date) === 0 || getDay(header.date) === 6);
                    return (
                      <div
                        key={i}
                        className={`cp-timeline-header-unit ${zoomLevel} ${isWeekend ? 'weekend' : ''}`}
                        style={{ minWidth: `${header.width}px`, width: `${header.width}px` }}
                      >
                        <span>{header.label}</span>
                        {zoomLevel === 'day' && (
                          <span className="day-name">{format(header.date, 'EEE')}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="cp-timeline-body" ref={timelineBodyRef} onScroll={handleTimelineScroll}>
                  <div className="cp-timeline-content" style={{ width: `${timelineConfig.width}px` }}>
                    {/* Grid lines */}
                    {timelineHeaders.map((header, i) => (
                      <div
                        key={i}
                        className={`cp-grid-line ${zoomLevel === 'day' && (getDay(header.date) === 0 || getDay(header.date) === 6) ? 'weekend' : ''}`}
                        style={{ left: `${i * header.width}px`, width: `${header.width}px` }}
                      />
                    ))}

                    {/* Dependency lines SVG overlay */}
                    <svg
                      className="cp-dependency-lines"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${taskBarPositions.length * 40}px`,
                        pointerEvents: 'none',
                        overflow: 'visible'
                      }}
                    >
                      <defs>
                        <marker
                          id="cp-arrowhead"
                          markerWidth="8"
                          markerHeight="8"
                          refX="7"
                          refY="4"
                          orient="auto"
                        >
                          <polygon points="0 0, 8 4, 0 8" fill="#dc2626" />
                        </marker>
                      </defs>
                      {dependencyConnections.map((conn, idx) => {
                        // Draw a path with right-angle corners
                        const midX = conn.fromX + 15;
                        const path = conn.fromY === conn.toY
                          ? `M ${conn.fromX} ${conn.fromY} L ${conn.toX - 5} ${conn.toY}`
                          : `M ${conn.fromX} ${conn.fromY}
                             L ${midX} ${conn.fromY}
                             L ${midX} ${conn.toY}
                             L ${conn.toX - 5} ${conn.toY}`;

                        return (
                          <path
                            key={idx}
                            d={path}
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth="2"
                            markerEnd="url(#cp-arrowhead)"
                            className="cp-dependency-line"
                          />
                        );
                      })}
                    </svg>

                    {/* Task bars */}
                    {taskBarPositions.map((pos, index) => (
                      <div
                        key={pos.task.id}
                        className="cp-bar-row"
                        style={{ top: `${index * 40}px` }}
                      >
                        {pos.task.milestone ? (
                          <>
                            <div
                              className="cp-milestone-marker"
                              style={{ left: `${pos.barStart}px` }}
                              title={`${pos.task.name} - ${format(pos.startDate, 'MMM d, yyyy')}`}
                            >
                              <Diamond size={16} />
                            </div>
                            <span
                              className="cp-bar-label-outside"
                              style={{ left: `${pos.barStart + 20}px` }}
                            >
                              {pos.task.name}
                            </span>
                          </>
                        ) : (
                          <>
                            <div
                              className="cp-gantt-bar"
                              style={{
                                left: `${pos.barStart}px`,
                                width: `${Math.max(pos.barWidth, 20)}px`
                              }}
                              title={`${pos.task.name}\n${format(pos.startDate, 'MMM d')} - ${format(pos.endDate, 'MMM d, yyyy')}\nDuration: ${formatDuration(pos.task.duration)}`}
                            >
                              <div
                                className="cp-bar-progress"
                                style={{ width: `${pos.task.percent_complete}%` }}
                              />
                            </div>
                            <span
                              className="cp-bar-label-outside"
                              style={{ left: `${pos.barStart + Math.max(pos.barWidth, 20) + 8}px` }}
                            >
                              {pos.task.name}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="cp-legend">
              <div className="cp-legend-item">
                <div className="cp-legend-bar critical"></div>
                <span>Critical Path Task</span>
              </div>
              <div className="cp-legend-item">
                <div className="cp-legend-bar progress"></div>
                <span>Progress</span>
              </div>
              <div className="cp-legend-item">
                <Diamond size={14} className="cp-legend-milestone" />
                <span>Milestone</span>
              </div>
              <div className="cp-legend-item">
                <svg width="30" height="14" className="cp-legend-dependency">
                  <line x1="0" y1="7" x2="25" y2="7" stroke="#dc2626" strokeWidth="2" />
                  <polygon points="25 4, 30 7, 25 10" fill="#dc2626" />
                </svg>
                <span>Dependency</span>
              </div>
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

