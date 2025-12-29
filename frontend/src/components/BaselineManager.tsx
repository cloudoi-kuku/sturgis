import React, { useState, useEffect } from 'react';
import { X, GitBranch, Check, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { getBaselines, setBaseline, clearBaseline, type BaselineInfo } from '../api/client';
import './BaselineManager.css';

interface BaselineManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onBaselineChanged: () => void;
}

export const BaselineManager: React.FC<BaselineManagerProps> = ({
  isOpen,
  onClose,
  onBaselineChanged,
}) => {
  const [baselines, setBaselines] = useState<BaselineInfo[]>([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBaseline, setSelectedBaseline] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Load baselines when modal opens
  useEffect(() => {
    if (isOpen) {
      loadBaselines();
    }
  }, [isOpen]);

  const loadBaselines = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getBaselines();
      setBaselines(response.baselines);
      setTotalTasks(response.total_tasks);
    } catch (err) {
      setError('Failed to load baselines');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetBaseline = async (baselineNumber: number) => {
    setActionLoading(baselineNumber);
    setError(null);
    try {
      await setBaseline(baselineNumber);
      await loadBaselines();
      onBaselineChanged();
    } catch (err) {
      setError(`Failed to set baseline ${baselineNumber}`);
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearBaseline = async (baselineNumber: number) => {
    if (!confirm(`Are you sure you want to clear Baseline ${baselineNumber}?`)) {
      return;
    }
    setActionLoading(baselineNumber);
    setError(null);
    try {
      await clearBaseline(baselineNumber);
      await loadBaselines();
      onBaselineChanged();
    } catch (err) {
      setError(`Failed to clear baseline ${baselineNumber}`);
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const getBaselineInfo = (num: number): BaselineInfo | undefined => {
    return baselines.find(b => b.number === num);
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="baseline-manager-overlay" onClick={onClose}>
      <div className="baseline-manager-modal" onClick={e => e.stopPropagation()}>
        <div className="baseline-manager-header">
          <h2>
            <GitBranch size={20} />
            Baseline Manager
          </h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="baseline-manager-content">
          {error && (
            <div className="baseline-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="baseline-info-bar">
            <span>Total Tasks: <strong>{totalTasks}</strong></span>
            <span>Baselines Set: <strong>{baselines.length}</strong></span>
          </div>

          {loading ? (
            <div className="baseline-loading">
              <Loader2 className="spin" size={24} />
              Loading baselines...
            </div>
          ) : (
            <div className="baseline-list">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => {
                const info = getBaselineInfo(num);
                const isLoading = actionLoading === num;
                
                return (
                  <div 
                    key={num} 
                    className={`baseline-item ${info ? 'has-data' : ''} ${selectedBaseline === num ? 'selected' : ''}`}
                    onClick={() => setSelectedBaseline(num)}
                  >
                    <div className="baseline-item-info">
                      <span className="baseline-number">Baseline {num}</span>
                      {info ? (
                        <span className="baseline-details">
                          {info.task_count} tasks • Set {formatDate(info.set_date)}
                        </span>
                      ) : (
                        <span className="baseline-details empty">Not set</span>
                      )}
                    </div>
                    <div className="baseline-item-actions">
                      <button
                        className="baseline-action-btn set"
                        onClick={(e) => { e.stopPropagation(); handleSetBaseline(num); }}
                        disabled={isLoading}
                        title={info ? 'Update Baseline' : 'Set Baseline'}
                      >
                        {isLoading ? <Loader2 className="spin" size={14} /> : <Check size={14} />}
                        {info ? 'Update' : 'Set'}
                      </button>
                      {info && (
                        <button
                          className="baseline-action-btn clear"
                          onClick={(e) => { e.stopPropagation(); handleClearBaseline(num); }}
                          disabled={isLoading}
                          title="Clear Baseline"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

