import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, FileJson, FileType, ChevronDown, X, FileOutput, ImagePlus, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Task, ProjectMetadata } from '../api/client';
import { getCriticalPath } from '../api/client';
import { format, parseISO, addDays } from 'date-fns';
import './ExportMenu.css';

interface ExportMenuProps {
  tasks: Task[];
  metadata: ProjectMetadata | undefined;
  onExportXML: () => void;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({ tasks, metadata, onExportXML }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasClientLogo, setHasClientLogo] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if client logo exists on mount
  useEffect(() => {
    setHasClientLogo(!!localStorage.getItem('clientLogo'));
  }, []);

  // Handle client logo upload
  const handleClientLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      localStorage.setItem('clientLogo', base64);
      setHasClientLogo(true);
      alert('Client logo uploaded successfully! It will appear in PDF exports.');
    };
    reader.readAsDataURL(file);
  };

  // Remove client logo
  const handleRemoveClientLogo = () => {
    localStorage.removeItem('clientLogo');
    setHasClientLogo(false);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper: Parse duration to days
  const parseDuration = (duration: string): number => {
    const match = duration.match(/PT(\d+)H/);
    if (match) {
      return parseInt(match[1]) / 8;
    }
    return 0;
  };

  // Helper: Calculate task dates based on predecessors
  const calculateTaskDates = () => {
    if (!metadata?.start_date) return new Map<string, { start: Date; finish: Date }>();

    const startDate = parseISO(metadata.start_date);
    const taskMap = new Map(tasks.map(t => [t.outline_number, t]));
    const taskDates = new Map<string, { start: Date; finish: Date }>();

    const calculateDate = (task: Task): { start: Date; finish: Date } => {
      if (taskDates.has(task.outline_number)) {
        return taskDates.get(task.outline_number)!;
      }

      let taskStart = startDate;

      if (task.predecessors && task.predecessors.length > 0) {
        for (const pred of task.predecessors) {
          const predTask = taskMap.get(pred.outline_number);
          if (predTask) {
            const predDates = calculateDate(predTask);
            // Convert lag based on lag_format
            const lagValue = pred.lag || 0;
            const lagFormat = pred.lag_format || 7;
            let lagDays = 0;
            if (lagFormat === 3) {
              lagDays = lagValue / 480; // Elapsed minutes
            } else if (lagFormat === 5 || lagFormat === 6) {
              lagDays = lagValue / 8; // Hours
            } else if (lagFormat === 7 || lagFormat === 8) {
              lagDays = lagValue; // Days
            } else if (lagFormat === 9 || lagFormat === 10) {
              lagDays = lagValue * 5; // Weeks
            } else if (lagFormat === 11 || lagFormat === 12) {
              lagDays = lagValue * 20; // Months
            } else {
              lagDays = lagValue;
            }
            const predEnd = addDays(predDates.finish, lagDays);
            if (predEnd > taskStart) {
              taskStart = predEnd;
            }
          }
        }
      }

      const duration = parseDuration(task.duration);
      const taskFinish = addDays(taskStart, duration);

      const dates = { start: taskStart, finish: taskFinish };
      taskDates.set(task.outline_number, dates);
      return dates;
    };

    tasks.forEach(task => calculateDate(task));
    return taskDates;
  };

  // Export to Excel
  const handleExportExcel = () => {
    const taskDates = calculateTaskDates();

    const data = tasks.map(task => {
      const dates = taskDates.get(task.outline_number);
      return {
        'WBS': task.outline_number,
        'Task Name': task.name,
        'Duration (days)': parseDuration(task.duration),
        'Start Date': dates ? format(dates.start, 'yyyy-MM-dd') : '',
        'Finish Date': dates ? format(dates.finish, 'yyyy-MM-dd') : '',
        'Progress (%)': task.percent_complete,
        'Milestone': task.milestone ? 'Yes' : 'No',
        'Summary': task.summary ? 'Yes' : 'No',
        'Predecessors': task.predecessors?.map(p => p.outline_number).join(', ') || '',
        'Custom Value': task.value || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();

    // Set column widths
    ws['!cols'] = [
      { wch: 10 },  // WBS
      { wch: 40 },  // Task Name
      { wch: 15 },  // Duration
      { wch: 12 },  // Start Date
      { wch: 12 },  // Finish Date
      { wch: 12 },  // Progress
      { wch: 10 },  // Milestone
      { wch: 10 },  // Summary
      { wch: 20 },  // Predecessors
      { wch: 15 },  // Custom Value
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');

    // Add project info sheet
    const projectInfo = [
      { Field: 'Project Name', Value: metadata?.name || '' },
      { Field: 'Start Date', Value: metadata?.start_date || '' },
      { Field: 'Status Date', Value: metadata?.status_date || '' },
      { Field: 'Total Tasks', Value: tasks.length },
      { Field: 'Export Date', Value: format(new Date(), 'yyyy-MM-dd HH:mm:ss') }
    ];
    const wsInfo = XLSX.utils.json_to_sheet(projectInfo);
    wsInfo['!cols'] = [{ wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsInfo, 'Project Info');

    XLSX.writeFile(wb, `${metadata?.name || 'project'}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    setIsOpen(false);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const taskDates = calculateTaskDates();

    const headers = ['WBS', 'Task Name', 'Duration (days)', 'Start Date', 'Finish Date', 'Progress (%)', 'Milestone', 'Summary', 'Predecessors', 'Custom Value'];
    const rows = tasks.map(task => {
      const dates = taskDates.get(task.outline_number);
      return [
        task.outline_number,
        `"${task.name.replace(/"/g, '""')}"`,
        parseDuration(task.duration),
        dates ? format(dates.start, 'yyyy-MM-dd') : '',
        dates ? format(dates.finish, 'yyyy-MM-dd') : '',
        task.percent_complete,
        task.milestone ? 'Yes' : 'No',
        task.summary ? 'Yes' : 'No',
        `"${task.predecessors?.map(p => p.outline_number).join(', ') || ''}"`,
        `"${task.value || ''}"`
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata?.name || 'project'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  // Export to JSON
  const handleExportJSON = () => {
    const taskDates = calculateTaskDates();

    const exportData = {
      project: {
        name: metadata?.name || '',
        start_date: metadata?.start_date || '',
        status_date: metadata?.status_date || '',
        export_date: new Date().toISOString()
      },
      tasks: tasks.map(task => {
        const dates = taskDates.get(task.outline_number);
        return {
          wbs: task.outline_number,
          name: task.name,
          duration_days: parseDuration(task.duration),
          start_date: dates ? format(dates.start, 'yyyy-MM-dd') : null,
          finish_date: dates ? format(dates.finish, 'yyyy-MM-dd') : null,
          progress: task.percent_complete,
          milestone: task.milestone,
          summary: task.summary,
          predecessors: task.predecessors?.map(p => {
            // Convert lag to days based on lag_format
            const lagValue = p.lag || 0;
            const lagFormat = p.lag_format || 7;
            let lagDays = 0;
            if (lagFormat === 3) {
              lagDays = lagValue / 480;
            } else if (lagFormat === 5 || lagFormat === 6) {
              lagDays = lagValue / 8;
            } else if (lagFormat === 7 || lagFormat === 8) {
              lagDays = lagValue;
            } else if (lagFormat === 9 || lagFormat === 10) {
              lagDays = lagValue * 5;
            } else if (lagFormat === 11 || lagFormat === 12) {
              lagDays = lagValue * 20;
            } else {
              lagDays = lagValue;
            }
            return {
              wbs: p.outline_number,
              type: p.type === 1 ? 'FS' : p.type === 0 ? 'FF' : p.type === 2 ? 'SF' : 'SS',
              lag_days: lagDays
            };
          }) || [],
          custom_value: task.value || null
        };
      })
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata?.name || 'project'}-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  // Export to Text (formatted report)
  const handleExportText = () => {
    const taskDates = calculateTaskDates();

    const lines = [
      '═══════════════════════════════════════════════════════════════════',
      `PROJECT: ${metadata?.name || 'Untitled'}`,
      '═══════════════════════════════════════════════════════════════════',
      `Start Date: ${metadata?.start_date || 'N/A'}`,
      `Status Date: ${metadata?.status_date || 'N/A'}`,
      `Total Tasks: ${tasks.length}`,
      `Export Date: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`,
      '',
      '───────────────────────────────────────────────────────────────────',
      'TASK LIST',
      '───────────────────────────────────────────────────────────────────',
      ''
    ];

    tasks.forEach((task, index) => {
      const dates = taskDates.get(task.outline_number);
      const indent = '  '.repeat(task.outline_level);

      lines.push(`${index + 1}. ${indent}${task.name}`);
      lines.push(`   ${indent}WBS: ${task.outline_number}`);
      lines.push(`   ${indent}Duration: ${parseDuration(task.duration)} days`);
      if (dates) {
        lines.push(`   ${indent}Start: ${format(dates.start, 'MMM dd, yyyy')} | Finish: ${format(dates.finish, 'MMM dd, yyyy')}`);
      }
      lines.push(`   ${indent}Progress: ${task.percent_complete}%${task.milestone ? ' | MILESTONE' : ''}${task.summary ? ' | SUMMARY' : ''}`);
      if (task.predecessors && task.predecessors.length > 0) {
        lines.push(`   ${indent}Predecessors: ${task.predecessors.map(p => p.outline_number).join(', ')}`);
      }
      lines.push('');
    });

    lines.push('═══════════════════════════════════════════════════════════════════');

    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata?.name || 'project'}-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setIsOpen(false);
  };

  // Helper function to load image as base64 with dimensions
  const loadImageAsBase64 = (src: string): Promise<{ base64: string; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve({
            base64: canvas.toDataURL('image/png'),
            width: img.width,
            height: img.height
          });
        } else {
          reject(new Error('Could not get canvas context'));
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  };

  // Export to PDF - 11x17 Tabloid with Table and Gantt Chart combined (MS Project style)
  // Multi-page support with critical path highlighting
  const handleExportPDF = async () => {
    const taskDates = calculateTaskDates();

    // Load Sturgis logo (black version for white PDF background)
    let sturgisLogoData: { base64: string; width: number; height: number } | null = null;
    try {
      sturgisLogoData = await loadImageAsBase64('/sturgis-logo-black.png');
    } catch (error) {
      console.warn('Could not load Sturgis logo:', error);
    }

    // Fetch critical path data
    let criticalTaskIds = new Set<string>();
    try {
      const criticalPathResult = await getCriticalPath();
      criticalTaskIds = new Set(criticalPathResult.critical_task_ids || []);
    } catch (error) {
      console.warn('Could not fetch critical path:', error);
    }

    // 11x17 inch = 279.4 x 431.8 mm, landscape orientation
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [279.4, 431.8]
    });

    const pageWidth = 431.8;
    const pageHeight = 279.4;
    const margin = 12;
    const headerHeight = 22;
    const footerHeight = 18;
    const rowHeight = 9;  // Increased from 7 for better readability
    const headerRowHeight = 10;  // Increased from 8

    // Calculate pagination
    const contentStartY = headerHeight + 2;
    const contentEndY = pageHeight - footerHeight;
    const availableHeight = contentEndY - contentStartY - headerRowHeight;
    const tasksPerPage = Math.floor(availableHeight / rowHeight);
    const totalPages = Math.ceil(tasks.length / tasksPerPage);

    // Build outline to task number mapping
    const outlineToTaskNum = new Map<string, number>();
    tasks.forEach((task, index) => {
      outlineToTaskNum.set(task.outline_number, index + 1);
    });

    // Calculate project timeline
    const allDates: Date[] = [];
    taskDates.forEach(dates => {
      allDates.push(dates.start, dates.finish);
    });

    let projectStart = new Date();
    let projectEnd = new Date();
    let totalDays = 30;

    if (allDates.length > 0) {
      projectStart = new Date(Math.min(...allDates.map(d => d.getTime())));
      projectEnd = new Date(Math.max(...allDates.map(d => d.getTime())));
      totalDays = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) || 1;
    }

    // Layout - removed % and Pred columns for bigger Gantt chart
    const tableWidth = 138;
    const ganttStartX = margin + tableWidth + 2;
    const ganttWidth = pageWidth - ganttStartX - margin;

    // Column widths: #, Name, Duration, Start, Finish (removed % and Pred)
    const colWidths = [10, 55, 25, 24, 24];
    const colHeaders = ['#', 'Task Name', 'Duration', 'Start', 'Finish'];

    // Colors - matching app's dark header theme (#0f1419)
    const headerBg: [number, number, number] = [15, 20, 25];
    const criticalRed: [number, number, number] = [231, 76, 60]; // #e74c3c - matches critical path bars
    const taskBlue: [number, number, number] = [52, 152, 219];
    const summaryGray: [number, number, number] = [44, 62, 80];
    const milestoneOrange: [number, number, number] = [243, 156, 18];

    // Draw page header
    const drawHeader = () => {
      // Sturgis logo (top left) - black logo on white background
      const logoX = margin;
      const logoY = 3;
      const logoHeight = 12;  // Slightly larger logo

      // Calculate logo width from actual image aspect ratio
      let logoWidth = logoHeight * 4.5; // Fallback aspect ratio
      if (sturgisLogoData) {
        logoWidth = logoHeight * (sturgisLogoData.width / sturgisLogoData.height);
      }

      // Add logo image if loaded
      if (sturgisLogoData) {
        try {
          doc.addImage(sturgisLogoData.base64, 'PNG', logoX, logoY, logoWidth, logoHeight);
        } catch (e) {
          // Fallback text if image fails
          doc.setFontSize(11);
          doc.setTextColor(30, 41, 59);
          doc.setFont('helvetica', 'bold');
          doc.text('STURGIS CONSTRUCTION', logoX, logoY + 8);
        }
      } else {
        // Fallback text if no logo
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text('STURGIS CONSTRUCTION', logoX, logoY + 8);
      }

      // Project title
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(44, 62, 80);
      doc.text(metadata?.name || 'Project Schedule', pageWidth / 2, 10, { align: 'center' });

      // Project info
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Start: ${metadata?.start_date || 'N/A'}  |  Status: ${metadata?.status_date || 'N/A'}  |  Tasks: ${tasks.length}`,
        pageWidth / 2, 16, { align: 'center' }
      );
    };

    // Draw page footer
    const drawFooter = (pageNum: number) => {
      const footerY = pageHeight - 9;

      // Date details (lower left)
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, margin, footerY - 1);
      doc.text(`Project Start: ${metadata?.start_date || 'N/A'}`, margin, footerY + 2.5);

      // File name and page (center)
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(44, 62, 80);
      doc.text(`${metadata?.name || 'Project'}`, pageWidth / 2, footerY - 1, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(120, 120, 120);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, footerY + 2.5, { align: 'center' });

      // Client logo placeholder (lower right)
      const clientLogoWidth = 35;
      const clientLogoHeight = 10;
      const clientLogoX = pageWidth - margin - clientLogoWidth;
      const clientLogoY = footerY - 5;

      // Check if client logo is stored in localStorage
      const clientLogoBase64 = localStorage.getItem('clientLogo');
      if (clientLogoBase64) {
        try {
          doc.addImage(clientLogoBase64, 'PNG', clientLogoX, clientLogoY, clientLogoWidth, clientLogoHeight);
        } catch (e) {
          // Draw placeholder if image fails
          doc.setDrawColor(200, 200, 200);
          doc.setFillColor(250, 250, 250);
          doc.roundedRect(clientLogoX, clientLogoY, clientLogoWidth, clientLogoHeight, 1, 1, 'FD');
          doc.setFontSize(5);
          doc.setTextColor(160, 160, 160);
          doc.text('CLIENT LOGO', clientLogoX + clientLogoWidth / 2, clientLogoY + clientLogoHeight / 2 + 1, { align: 'center' });
        }
      } else {
        // Draw placeholder box
        doc.setDrawColor(200, 200, 200);
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(clientLogoX, clientLogoY, clientLogoWidth, clientLogoHeight, 1, 1, 'FD');
        doc.setFontSize(5);
        doc.setTextColor(160, 160, 160);
        doc.text('CLIENT LOGO', clientLogoX + clientLogoWidth / 2, clientLogoY + clientLogoHeight / 2 + 1, { align: 'center' });
      }
    };

    // Draw column headers
    const drawColumnHeaders = (startY: number) => {
      // Table header
      doc.setFillColor(...headerBg);
      doc.rect(margin, startY, tableWidth, headerRowHeight, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);

      let xPos = margin + 2;
      colHeaders.forEach((header, i) => {
        doc.text(header, xPos, startY + headerRowHeight - 2);
        xPos += colWidths[i];
      });

      // Gantt header
      doc.setFillColor(...headerBg);
      doc.rect(ganttStartX, startY, ganttWidth, headerRowHeight, 'F');

      // Timeline months
      doc.setFontSize(6);
      const currentDate = new Date(projectStart);
      while (currentDate <= projectEnd) {
        const dayOffset = Math.ceil((currentDate.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
        const headerXPos = ganttStartX + (dayOffset / totalDays) * ganttWidth;
        if (currentDate.getDate() === 1 || currentDate.getTime() === projectStart.getTime()) {
          doc.text(format(currentDate, 'MMM yy'), headerXPos + 1, startY + headerRowHeight - 2);
        }
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(1);
      }

      return startY + headerRowHeight;
    };

    // Draw task row with critical path highlighting
    const drawTaskRow = (task: typeof tasks[0], y: number, globalIndex: number) => {
      const dates = taskDates.get(task.outline_number);
      const isCritical = criticalTaskIds.has(task.id);

      // Row background color
      let rowBg: [number, number, number];
      if (isCritical) {
        rowBg = [255, 235, 235]; // Light red for critical
      } else if (task.summary) {
        rowBg = [240, 248, 255]; // Light blue for summary
      } else if (globalIndex % 2 === 0) {
        rowBg = [252, 252, 252];
      } else {
        rowBg = [255, 255, 255];
      }

      doc.setFillColor(...rowBg);
      doc.rect(margin, y, tableWidth, rowHeight, 'F');
      doc.rect(ganttStartX, y, ganttWidth, rowHeight, 'F');

      // Grid lines
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.1);
      doc.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
      doc.line(ganttStartX, y + rowHeight, ganttStartX + ganttWidth, y + rowHeight);

      // Month grid lines in Gantt
      doc.setDrawColor(240, 240, 240);
      const gridDate = new Date(projectStart);
      while (gridDate <= projectEnd) {
        const dayOffset = Math.ceil((gridDate.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
        const gridX = ganttStartX + (dayOffset / totalDays) * ganttWidth;
        if (gridDate.getDate() === 1) {
          doc.line(gridX, y, gridX, y + rowHeight);
        }
        gridDate.setMonth(gridDate.getMonth() + 1);
        gridDate.setDate(1);
      }

      // Table content - text color based on critical status
      doc.setFontSize(6);
      if (isCritical) {
        doc.setTextColor(...criticalRed);
      } else {
        doc.setTextColor(40, 40, 40);
      }
      doc.setFont('helvetica', task.summary ? 'bold' : 'normal');

      let xPos = margin + 2;
      const textY = y + rowHeight - 2;

      // # column
      doc.text((globalIndex + 1).toString(), xPos, textY);
      xPos += colWidths[0];

      // Task name with indent
      const indent = '  '.repeat(Math.max(0, task.outline_level - 1));
      let taskName = indent + task.name;
      if (taskName.length > 28) taskName = taskName.substring(0, 26) + '..';
      doc.text(taskName, xPos, textY);
      xPos += colWidths[1];

      // Duration
      const durationDays = parseDuration(task.duration);
      doc.text(`${durationDays} day${durationDays !== 1 ? 's' : ''}`, xPos, textY);
      xPos += colWidths[2];

      // Start
      doc.text(dates ? format(dates.start, 'MM/dd/yy') : '-', xPos, textY);
      xPos += colWidths[3];

      // Finish
      doc.text(dates ? format(dates.finish, 'MM/dd/yy') : '-', xPos, textY);

      // Gantt bar
      if (dates) {
        const startOffset = (dates.start.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24);
        const duration = (dates.finish.getTime() - dates.start.getTime()) / (1000 * 60 * 60 * 24);
        const barX = ganttStartX + (startOffset / totalDays) * ganttWidth;
        const barWidth = Math.max(2, (duration / totalDays) * ganttWidth);
        const barHeight = rowHeight - 2;
        const barY = y + 1;

        doc.setFontSize(5);
        const labelName = task.name.length > 28 ? task.name.substring(0, 26) + '..' : task.name;

        // Choose color based on critical path
        const barColor = isCritical ? criticalRed : (task.milestone ? milestoneOrange : (task.summary ? summaryGray : taskBlue));

        if (task.milestone) {
          // Diamond
          doc.setFillColor(...barColor);
          const mx = barX;
          const my = barY + barHeight / 2;
          doc.triangle(mx, my - 2, mx + 2, my, mx, my + 2, 'F');
          doc.triangle(mx, my - 2, mx - 2, my, mx, my + 2, 'F');
          doc.setTextColor(...barColor);
          doc.setFont('helvetica', 'bold');
          doc.text(labelName, mx + 3, textY);
        } else if (task.summary) {
          // Summary bar
          doc.setFillColor(...barColor);
          doc.rect(barX, barY + barHeight * 0.35, barWidth, barHeight * 0.3, 'F');
          doc.triangle(barX, barY + barHeight * 0.35, barX, barY + barHeight * 0.65, barX - 1, barY + barHeight / 2, 'F');
          doc.triangle(barX + barWidth, barY + barHeight * 0.35, barX + barWidth, barY + barHeight * 0.65, barX + barWidth + 1, barY + barHeight / 2, 'F');
          doc.setTextColor(...barColor);
          doc.setFont('helvetica', 'bold');
          doc.text(labelName, barX + barWidth + 2, textY);
        } else {
          // Regular task bar
          doc.setFillColor(...barColor);
          doc.roundedRect(barX, barY, barWidth, barHeight, 0.5, 0.5, 'F');
          doc.setTextColor(...barColor);
          doc.setFont('helvetica', 'normal');
          doc.text(labelName, barX + barWidth + 2, textY);
        }
      }
    };

    // Draw dependency lines between tasks
    const drawDependencyLines = (dataStartY: number, startIdx: number, endIdx: number) => {
      // Create task index map for quick lookup
      const taskIndexMap = new Map<string, number>();
      tasks.forEach((t, idx) => taskIndexMap.set(t.outline_number, idx));

      for (let i = startIdx; i < endIdx; i++) {
        const task = tasks[i];
        if (!task.predecessors || task.predecessors.length === 0) continue;

        const dates = taskDates.get(task.outline_number);
        if (!dates) continue;

        // Calculate task bar position
        const taskRowY = dataStartY + (i - startIdx) * rowHeight;
        const taskStartOffset = (dates.start.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24);
        const taskBarX = ganttStartX + (taskStartOffset / totalDays) * ganttWidth;
        const taskBarY = taskRowY + rowHeight / 2;

        for (const pred of task.predecessors) {
          const predIdx = taskIndexMap.get(pred.outline_number);
          if (predIdx === undefined) continue;

          // Check if predecessor is on this page
          if (predIdx < startIdx || predIdx >= endIdx) continue;

          const predTask = tasks[predIdx];
          const predDates = taskDates.get(predTask.outline_number);
          if (!predDates) continue;

          // Calculate predecessor bar end position
          const predRowY = dataStartY + (predIdx - startIdx) * rowHeight;
          const predStartOffset = (predDates.start.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24);
          const predDuration = (predDates.finish.getTime() - predDates.start.getTime()) / (1000 * 60 * 60 * 24);
          const predBarEndX = ganttStartX + ((predStartOffset + predDuration) / totalDays) * ganttWidth;
          const predBarY = predRowY + rowHeight / 2;

          // Check if it's a critical path dependency
          const isCriticalDep = criticalTaskIds.has(task.id) && criticalTaskIds.has(predTask.id);

          // Set line color and width (thicker for critical path)
          if (isCriticalDep) {
            doc.setDrawColor(...criticalRed);
            doc.setLineWidth(0.5);
          } else {
            doc.setDrawColor(90, 108, 125); // #5a6c7d
            doc.setLineWidth(0.35);
          }

          // Routing parameters
          const exitGap = 1.5;    // Gap when leaving predecessor bar (mm)
          const entryGap = 0.5;   // Small gap before arrow touches successor bar
          const minHorizontalGap = 6;
          const verticalPadding = 4;

          // Start and end points
          const startX = predBarEndX;
          const endX = taskBarX - entryGap;

          // Draw path with right-angle routing
          if (endX > startX + minHorizontalGap) {
            // Simple case: successor bar is to the right with enough space
            const midX = startX + Math.min(4, (endX - startX) * 0.4);

            // Draw: from pred bar end -> horizontal -> vertical -> horizontal to task
            doc.line(predBarEndX, predBarY, midX, predBarY);  // Horizontal from pred
            doc.line(midX, predBarY, midX, taskBarY);          // Vertical
            doc.line(midX, taskBarY, endX, taskBarY);          // Horizontal to task
          } else {
            // Complex case: route around
            const routeX1 = predBarEndX + exitGap + 2;
            const routeX2 = taskBarX - entryGap - 2;

            // Route above or below based on relative positions
            const routeAbove = predBarY > taskBarY;
            const clearanceY = routeAbove
              ? Math.min(predBarY, taskBarY) - verticalPadding
              : Math.max(predBarY, taskBarY) + verticalPadding;

            doc.line(predBarEndX, predBarY, routeX1, predBarY);    // Right from pred
            doc.line(routeX1, predBarY, routeX1, clearanceY);       // To clearance level
            doc.line(routeX1, clearanceY, routeX2, clearanceY);     // Horizontal
            doc.line(routeX2, clearanceY, routeX2, taskBarY);       // To successor level
            doc.line(routeX2, taskBarY, endX, taskBarY);            // To successor
          }

          // Draw arrow at the end (pointing right, touching the bar)
          // Slightly larger arrow for critical path
          const arrowWidth = isCriticalDep ? 1.5 : 1.2;
          const arrowHeight = isCriticalDep ? 1.0 : 0.8;
          doc.setFillColor(isCriticalDep ? criticalRed[0] : 90, isCriticalDep ? criticalRed[1] : 108, isCriticalDep ? criticalRed[2] : 125);
          doc.triangle(
            taskBarX, taskBarY,                           // Arrow tip at bar
            taskBarX - arrowWidth, taskBarY - arrowHeight,  // Top left
            taskBarX - arrowWidth, taskBarY + arrowHeight,  // Bottom left
            'F'
          );
        }
      }
    };

    // Generate pages
    for (let page = 0; page < totalPages; page++) {
      if (page > 0) doc.addPage();

      drawHeader();
      const dataStartY = drawColumnHeaders(contentStartY);

      const startIdx = page * tasksPerPage;
      const endIdx = Math.min(startIdx + tasksPerPage, tasks.length);

      for (let i = startIdx; i < endIdx; i++) {
        const rowY = dataStartY + (i - startIdx) * rowHeight;
        drawTaskRow(tasks[i], rowY, i);
      }

      // Draw dependency lines after task bars
      drawDependencyLines(dataStartY, startIdx, endIdx);

      // Borders
      const tableEndY = dataStartY + (endIdx - startIdx) * rowHeight;
      doc.setDrawColor(...headerBg);
      doc.setLineWidth(0.3);
      doc.rect(margin, contentStartY, tableWidth, tableEndY - contentStartY);
      doc.rect(ganttStartX, contentStartY, ganttWidth, tableEndY - contentStartY);

      // Legend on last page
      if (page === totalPages - 1) {
        const legendY = Math.min(tableEndY + 6, contentEndY - 3);
        doc.setFontSize(6);
        doc.setTextColor(80, 80, 80);

        let legendX = margin;

        doc.setFillColor(...taskBlue);
        doc.roundedRect(legendX, legendY - 2, 8, 3, 0.5, 0.5, 'F');
        doc.text('Task', legendX + 10, legendY);
        legendX += 28;

        doc.setFillColor(...criticalRed);
        doc.roundedRect(legendX, legendY - 2, 8, 3, 0.5, 0.5, 'F');
        doc.text('Critical Path', legendX + 10, legendY);
        legendX += 38;

        doc.setFillColor(...summaryGray);
        doc.rect(legendX, legendY - 1.5, 8, 2, 'F');
        doc.text('Summary', legendX + 10, legendY);
        legendX += 32;

        doc.setFillColor(...milestoneOrange);
        const mx = legendX + 2;
        doc.triangle(mx, legendY - 3, mx + 2, legendY - 0.5, mx, legendY + 2, 'F');
        doc.triangle(mx, legendY - 3, mx - 2, legendY - 0.5, mx, legendY + 2, 'F');
        doc.text('Milestone', legendX + 5, legendY);
      }

      drawFooter(page + 1);
    }

    doc.save(`${metadata?.name || 'project'}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    setIsOpen(false);
  };

  // Handle XML export (calls parent function)
  const handleExportXML = () => {
    onExportXML();
    setIsOpen(false);
  };

  return (
    <div className="export-menu-container" ref={menuRef}>
      <button
        className="action-button primary export-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={!metadata}
      >
        <Download size={18} />
        Export
        <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="export-dropdown">
          <div className="export-dropdown-header">
            <span>Export Project</span>
            <button className="close-dropdown" onClick={() => setIsOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="export-options">
            <button className="export-option" onClick={handleExportXML}>
              <FileType size={20} />
              <div className="export-option-info">
                <span className="export-option-title">MS Project XML</span>
                <span className="export-option-desc">Import directly into Microsoft Project</span>
              </div>
            </button>

            <button className="export-option" onClick={handleExportExcel}>
              <FileSpreadsheet size={20} />
              <div className="export-option-info">
                <span className="export-option-title">Excel Workbook (.xlsx)</span>
                <span className="export-option-desc">Open in Excel, Google Sheets, etc.</span>
              </div>
            </button>

            <button className="export-option" onClick={handleExportPDF}>
              <FileOutput size={20} />
              <div className="export-option-info">
                <span className="export-option-title">PDF Document</span>
                <span className="export-option-desc">Print-ready project schedule</span>
              </div>
            </button>

            <button className="export-option" onClick={handleExportCSV}>
              <FileText size={20} />
              <div className="export-option-info">
                <span className="export-option-title">CSV Spreadsheet</span>
                <span className="export-option-desc">Universal spreadsheet format</span>
              </div>
            </button>

            <button className="export-option" onClick={handleExportJSON}>
              <FileJson size={20} />
              <div className="export-option-info">
                <span className="export-option-title">JSON Data</span>
                <span className="export-option-desc">For developers and integrations</span>
              </div>
            </button>

            <button className="export-option" onClick={handleExportText}>
              <FileText size={20} />
              <div className="export-option-info">
                <span className="export-option-title">Text Report</span>
                <span className="export-option-desc">Human-readable project summary</span>
              </div>
            </button>
          </div>

          {/* Client Logo Section */}
          <div className="export-dropdown-divider"></div>
          <div className="export-dropdown-section">
            <span className="export-section-title">PDF Client Logo</span>
            <div className="client-logo-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleClientLogoUpload}
                style={{ display: 'none' }}
              />
              <button
                className="export-option client-logo-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={18} />
                <span>{hasClientLogo ? 'Change Logo' : 'Upload Logo'}</span>
              </button>
              {hasClientLogo && (
                <button
                  className="export-option client-logo-btn remove"
                  onClick={handleRemoveClientLogo}
                >
                  <Trash2 size={18} />
                  <span>Remove</span>
                </button>
              )}
            </div>
            <span className="export-option-desc" style={{ padding: '0 12px 8px', display: 'block' }}>
              {hasClientLogo ? '✓ Logo will appear in PDF footer' : 'Add client logo to PDF exports'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
