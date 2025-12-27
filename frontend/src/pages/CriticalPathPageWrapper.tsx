import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CriticalPathPage } from './CriticalPathPage';
import type { CriticalPathResult } from '../api/client';

export const CriticalPathPageWrapper = () => {
  const navigate = useNavigate();
  const [criticalPathData, setCriticalPathData] = useState<CriticalPathResult | null>(null);

  useEffect(() => {
    const dataStr = sessionStorage.getItem('criticalPathData');
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr) as CriticalPathResult;
        setCriticalPathData(data);
      } catch (error) {
        console.error('Failed to parse critical path data:', error);
        navigate('/');
      }
    } else {
      // No data found, redirect back to main page
      navigate('/');
    }
  }, [navigate]);

  if (!criticalPathData) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem',
        color: '#7f8c8d'
      }}>
        Loading critical path data...
      </div>
    );
  }

  return (
    <CriticalPathPage
      criticalTasks={criticalPathData.critical_tasks}
      projectDuration={criticalPathData.project_duration}
      taskFloats={criticalPathData.task_floats}
    />
  );
};

