import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, FileJson, FileType, ChevronDown, X, FileOutput } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Task, ProjectMetadata } from '../api/client';
import { format, parseISO, addDays } from 'date-fns';
import './ExportMenu.css';

interface ExportMenuProps {
  tasks: Task[];
  metadata: ProjectMetadata | undefined;
  onExportXML: () => void;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({ tasks, metadata, onExportXML }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
            const lagDays = (pred.lag || 0) / 480;
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
          predecessors: task.predecessors?.map(p => ({
            wbs: p.outline_number,
            type: p.type === 1 ? 'FS' : p.type === 0 ? 'FF' : p.type === 2 ? 'SF' : 'SS',
            lag_days: (p.lag || 0) / 480
          })) || [],
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

  // Export to PDF
  const handleExportPDF = () => {
    const taskDates = calculateTaskDates();
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Build outline to task number mapping (1-based index)
    const outlineToTaskNum = new Map<string, number>();
    tasks.forEach((task, index) => {
      outlineToTaskNum.set(task.outline_number, index + 1);
    });

    // Helper to convert predecessor outline numbers to task numbers
    const getPredecessorTaskNums = (predecessors: typeof tasks[0]['predecessors']) => {
      if (!predecessors || predecessors.length === 0) return '-';
      return predecessors
        .map(p => outlineToTaskNum.get(p.outline_number) || p.outline_number)
        .join(', ');
    };

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(metadata?.name || 'Project Schedule', 14, 20);

    // Project info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Start Date: ${metadata?.start_date || 'N/A'}`, 14, 28);
    doc.text(`Status Date: ${metadata?.status_date || 'N/A'}`, 14, 33);
    doc.text(`Total Tasks: ${tasks.length}`, 100, 28);
    doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 100, 33);

    // Task table
    const tableData = tasks.map((task, index) => {
      const dates = taskDates.get(task.outline_number);
      const indent = '  '.repeat(Math.max(0, task.outline_level - 1));
      return [
        (index + 1).toString(),
        indent + task.name,
        `${parseDuration(task.duration)}d`,
        dates ? format(dates.start, 'MM/dd/yy') : '-',
        dates ? format(dates.finish, 'MM/dd/yy') : '-',
        `${task.percent_complete}%`,
        getPredecessorTaskNums(task.predecessors)
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['#', 'Task Name', 'Duration', 'Start', 'Finish', 'Progress', 'Predecessors']],
      body: tableData,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [52, 152, 219],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 75 },
        2: { cellWidth: 18 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22 },
        5: { cellWidth: 18 },
        6: { cellWidth: 25 },
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      didParseCell: (data) => {
        const rowIndex = data.row.index;
        if (rowIndex >= 0 && tasks[rowIndex]?.summary) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [232, 245, 253];
        }
        if (rowIndex >= 0 && tasks[rowIndex]?.milestone) {
          data.cell.styles.fillColor = [255, 243, 224];
        }
      }
    });

    // Add Gantt Chart on new page
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text('Gantt Chart', 14, 15);

    // Calculate project timeline
    const allDates: Date[] = [];
    taskDates.forEach(dates => {
      allDates.push(dates.start, dates.finish);
    });

    if (allDates.length > 0) {
      const projectStart = new Date(Math.min(...allDates.map(d => d.getTime())));
      const projectEnd = new Date(Math.max(...allDates.map(d => d.getTime())));

      const chartStartX = 80;
      const chartWidth = 200;
      const chartStartY = 25;
      const rowHeight = 5;
      const totalDays = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24)) || 1;

      // Draw timeline header
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');

      // Draw month markers
      const currentDate = new Date(projectStart);
      while (currentDate <= projectEnd) {
        const dayOffset = Math.ceil((currentDate.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));
        const xPos = chartStartX + (dayOffset / totalDays) * chartWidth;
        if (currentDate.getDate() === 1 || currentDate.getTime() === projectStart.getTime()) {
          doc.setDrawColor(200);
          doc.line(xPos, chartStartY, xPos, chartStartY + tasks.length * rowHeight + 5);
          doc.setTextColor(100);
          doc.text(format(currentDate, 'MMM'), xPos + 1, chartStartY - 2);
        }
        currentDate.setDate(currentDate.getDate() + 7);
      }

      // Draw tasks
      tasks.forEach((task, index) => {
        const y = chartStartY + index * rowHeight;
        const dates = taskDates.get(task.outline_number);

        // Task name (truncated)
        doc.setFontSize(6);
        doc.setTextColor(0);
        const taskName = task.name.length > 30 ? task.name.substring(0, 28) + '...' : task.name;
        doc.text(`${index + 1}. ${taskName}`, 14, y + 3.5);

        if (dates) {
          const startOffset = (dates.start.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24);
          const duration = (dates.finish.getTime() - dates.start.getTime()) / (1000 * 60 * 60 * 24);
          const barX = chartStartX + (startOffset / totalDays) * chartWidth;
          const barWidth = Math.max(1, (duration / totalDays) * chartWidth);

          // Draw bar background
          if (task.milestone) {
            // Diamond for milestone
            doc.setFillColor(231, 76, 60);
            const mx = barX + barWidth / 2;
            const my = y + 2;
            doc.triangle(mx, my - 2, mx + 2, my, mx, my + 2, 'F');
            doc.triangle(mx, my - 2, mx - 2, my, mx, my + 2, 'F');
          } else if (task.summary) {
            // Black bar for summary
            doc.setFillColor(44, 62, 80);
            doc.rect(barX, y + 1, barWidth, 3, 'F');
          } else {
            // Blue bar for regular task
            doc.setFillColor(52, 152, 219);
            doc.rect(barX, y + 0.5, barWidth, 4, 'F');

            // Progress fill
            if (task.percent_complete > 0) {
              doc.setFillColor(39, 174, 96);
              doc.rect(barX, y + 0.5, barWidth * (task.percent_complete / 100), 4, 'F');
            }
          }
        }
      });

      // Legend
      const legendY = chartStartY + tasks.length * rowHeight + 15;
      doc.setFontSize(7);
      doc.setTextColor(0);
      doc.text('Legend:', 14, legendY);

      doc.setFillColor(52, 152, 219);
      doc.rect(35, legendY - 2.5, 8, 3, 'F');
      doc.text('Task', 45, legendY);

      doc.setFillColor(39, 174, 96);
      doc.rect(60, legendY - 2.5, 8, 3, 'F');
      doc.text('Progress', 70, legendY);

      doc.setFillColor(44, 62, 80);
      doc.rect(95, legendY - 2.5, 8, 3, 'F');
      doc.text('Summary', 105, legendY);

      doc.setFillColor(231, 76, 60);
      doc.rect(130, legendY - 2.5, 3, 3, 'F');
      doc.text('Milestone', 135, legendY);
    }

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
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
        </div>
      )}
    </div>
  );
};
