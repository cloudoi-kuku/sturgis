import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, BarChart3, GitBranch } from 'lucide-react';
import './LandingPage.css';

// Use logo from public folder
const sturgisLogo = '/sturgis-logo.png';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page internal">
      <div className="landing-container">
        {/* Left side - Branding */}
        <div className="landing-brand">
          <div className="brand-background">
            <div className="brand-pattern"></div>
          </div>
          <div className="brand-content">
            <img src={sturgisLogo} alt="Sturgis Construction" className="brand-logo" />
            <h1>Project Scheduler</h1>
            <p>Internal project management tool for the Sturgis team</p>

            <div className="brand-features">
              <div className="brand-feature">
                <Calendar size={20} />
                <span>Gantt Charts & Scheduling</span>
              </div>
              <div className="brand-feature">
                <GitBranch size={20} />
                <span>Critical Path Analysis</span>
              </div>
              <div className="brand-feature">
                <BarChart3 size={20} />
                <span>Progress Tracking</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="landing-actions">
          <div className="actions-content">
            <h2>Welcome back</h2>
            <p>Sign in to access your projects</p>

            <div className="action-buttons">
              <button className="btn-primary" onClick={() => navigate('/login')}>
                Sign In
                <ArrowRight size={20} />
              </button>
              <button className="btn-secondary" onClick={() => navigate('/register')}>
                Create Account
              </button>
            </div>

            <div className="landing-footer">
              <span>Sturgis Construction</span>
              <span className="separator">•</span>
              <span>Internal Use Only</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
