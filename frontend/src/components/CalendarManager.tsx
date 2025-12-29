import React, { useState, useEffect } from 'react';
import type { ProjectCalendar, CalendarException } from '../api/client';
import { X, Plus, Trash2, Calendar, Clock, AlertCircle } from 'lucide-react';
import './CalendarManager.css';

interface CalendarManagerProps {
  isOpen: boolean;
  onClose: () => void;
  calendar: ProjectCalendar | undefined;
  onSave: (calendar: ProjectCalendar) => void;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 7, label: 'Sunday', short: 'Sun' },
];

export const CalendarManager: React.FC<CalendarManagerProps> = ({
  isOpen,
  onClose,
  calendar,
  onSave,
}) => {
  const [workWeek, setWorkWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [hoursPerDay, setHoursPerDay] = useState<number>(8);
  const [exceptions, setExceptions] = useState<CalendarException[]>([]);
  const [newExceptionDate, setNewExceptionDate] = useState('');
  const [newExceptionName, setNewExceptionName] = useState('');
  const [newExceptionIsWorking, setNewExceptionIsWorking] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Initialize form when calendar data changes
  useEffect(() => {
    if (calendar) {
      setWorkWeek(calendar.work_week || [1, 2, 3, 4, 5]);
      setHoursPerDay(calendar.hours_per_day || 8);
      setExceptions(calendar.exceptions || []);
    }
  }, [calendar, isOpen]);

  if (!isOpen) return null;

  const handleDayToggle = (day: number) => {
    setWorkWeek(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => a - b)
    );
  };

  const handleAddException = () => {
    if (!newExceptionDate || !newExceptionName) return;

    // Check if date already exists
    const exists = exceptions.some(e => e.exception_date === newExceptionDate);
    if (exists) {
      alert('An exception already exists for this date');
      return;
    }

    setExceptions(prev => [
      ...prev,
      {
        exception_date: newExceptionDate,
        name: newExceptionName,
        is_working: newExceptionIsWorking,
      }
    ].sort((a, b) => a.exception_date.localeCompare(b.exception_date)));

    // Reset form
    setNewExceptionDate('');
    setNewExceptionName('');
    setNewExceptionIsWorking(false);
    setShowAddForm(false);
  };

  const handleRemoveException = (date: string) => {
    setExceptions(prev => prev.filter(e => e.exception_date !== date));
  };

  const handleSave = () => {
    onSave({
      work_week: workWeek,
      hours_per_day: hoursPerDay,
      exceptions: exceptions,
    });
    onClose();
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr + 'T00:00:00');
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="calendar-modal-overlay" onClick={onClose}>
      <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-modal-header">
          <div className="calendar-modal-title">
            <Calendar size={24} />
            <h2>Calendar Settings</h2>
          </div>
          <button className="calendar-modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="calendar-modal-content">
          {/* Work Week Section */}
          <section className="calendar-section">
            <h3>
              <Clock size={18} />
              Work Week
            </h3>
            <p className="section-description">
              Select which days are working days for this project.
            </p>
            <div className="work-week-grid">
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day.value}
                  className={`day-button ${workWeek.includes(day.value) ? 'active' : ''}`}
                  onClick={() => handleDayToggle(day.value)}
                >
                  <span className="day-short">{day.short}</span>
                  <span className="day-full">{day.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Hours Per Day Section */}
          <section className="calendar-section">
            <h3>
              <Clock size={18} />
              Hours Per Day
            </h3>
            <p className="section-description">
              Working hours per day (used for duration calculations).
            </p>
            <div className="hours-input-group">
              <input
                type="number"
                min="1"
                max="24"
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(Math.max(1, Math.min(24, parseInt(e.target.value) || 8)))}
                className="hours-input"
              />
              <span className="hours-label">hours</span>
            </div>
          </section>

          {/* Holidays Section */}
          <section className="calendar-section">
            <div className="section-header">
              <h3>
                <AlertCircle size={18} />
                Holidays & Exceptions
              </h3>
              <button
                className="add-exception-button"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                <Plus size={16} />
                Add Holiday
              </button>
            </div>
            <p className="section-description">
              Add non-working days (holidays) or working day overrides.
            </p>

            {/* Add Exception Form */}
            {showAddForm && (
              <div className="add-exception-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Date</label>
                    <input
                      type="date"
                      value={newExceptionDate}
                      onChange={(e) => setNewExceptionDate(e.target.value)}
                      className="date-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={newExceptionName}
                      onChange={(e) => setNewExceptionName(e.target.value)}
                      placeholder="e.g., Christmas Day"
                      className="name-input"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={newExceptionIsWorking}
                        onChange={(e) => setNewExceptionIsWorking(e.target.checked)}
                      />
                      <span>Working day override</span>
                    </label>
                    <small className="form-hint">
                      Check this to make a normally non-working day a working day
                    </small>
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    className="btn-cancel"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewExceptionDate('');
                      setNewExceptionName('');
                      setNewExceptionIsWorking(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-add"
                    onClick={handleAddException}
                    disabled={!newExceptionDate || !newExceptionName}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {/* Exceptions List */}
            <div className="exceptions-list">
              {exceptions.length === 0 ? (
                <div className="no-exceptions">
                  <p>No holidays or exceptions defined.</p>
                  <p className="hint">Click "Add Holiday" to add non-working days.</p>
                </div>
              ) : (
                exceptions.map((exception) => (
                  <div
                    key={exception.exception_date}
                    className={`exception-item ${exception.is_working ? 'working-override' : 'holiday'}`}
                  >
                    <div className="exception-info">
                      <span className="exception-date">{formatDate(exception.exception_date)}</span>
                      <span className="exception-name">{exception.name}</span>
                      {exception.is_working && (
                        <span className="exception-badge working">Working Day</span>
                      )}
                      {!exception.is_working && (
                        <span className="exception-badge holiday">Holiday</span>
                      )}
                    </div>
                    <button
                      className="remove-exception-button"
                      onClick={() => handleRemoveException(exception.exception_date)}
                      title="Remove exception"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="calendar-modal-footer">
          <div className="calendar-summary">
            <span>{workWeek.length} working days/week</span>
            <span>{hoursPerDay} hours/day</span>
            <span>{exceptions.filter(e => !e.is_working).length} holidays</span>
          </div>
          <div className="calendar-modal-actions">
            <button className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-save" onClick={handleSave}>
              Save Calendar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
