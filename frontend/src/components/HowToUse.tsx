import { X, Upload, Plus, Edit, Trash2, CheckCircle, Download, MessageCircle, Sparkles, GitBranch, Settings } from 'lucide-react';
import './HowToUse.css';

interface HowToUseProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HowToUse({ isOpen, onClose }: HowToUseProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="how-to-use-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📖 How to Use - Sturgis Project</h2>
          <button className="close-button" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-content">
          <section className="guide-section">
            <h3>🚀 Getting Started</h3>
            <div className="step">
              <div className="step-icon">
                <Upload size={20} />
              </div>
              <div className="step-content">
                <h4>1. Upload Your Project</h4>
                <p>Click the <strong>"Upload XML"</strong> button in the header to import an existing MS Project XML file. The tool will parse and display your project tasks in an interactive Gantt chart.</p>
              </div>
            </div>
          </section>

          <section className="guide-section">
            <h3>📋 Managing Tasks</h3>
            
            <div className="step">
              <div className="step-icon">
                <Plus size={20} />
              </div>
              <div className="step-content">
                <h4>Create New Task</h4>
                <p>Click <strong>"New Task"</strong> to add a task. Fill in the task name, duration, and other details. You can also set predecessors to create dependencies.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-icon">
                <Edit size={20} />
              </div>
              <div className="step-content">
                <h4>Edit Task</h4>
                <p>Click on any task in the Gantt chart to open the task editor. Modify task properties, add notes, or update dependencies.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-icon">
                <Trash2 size={20} />
              </div>
              <div className="step-content">
                <h4>Delete Task</h4>
                <p>Open the task editor and click the <strong>"Delete Task"</strong> button at the bottom to remove a task from your project.</p>
              </div>
            </div>
          </section>

          <section className="guide-section">
            <h3>🔗 Task Dependencies</h3>
            <div className="step">
              <div className="step-icon">
                <GitBranch size={20} />
              </div>
              <div className="step-content">
                <h4>Setting Predecessors</h4>
                <p>In the task editor, use the <strong>"Predecessors"</strong> section to define which tasks must complete before this task can start. Select the predecessor task and dependency type (Finish-to-Start, Start-to-Start, etc.).</p>
                <ul>
                  <li><strong>FS (Finish-to-Start):</strong> Task starts when predecessor finishes</li>
                  <li><strong>SS (Start-to-Start):</strong> Task starts when predecessor starts</li>
                  <li><strong>FF (Finish-to-Finish):</strong> Task finishes when predecessor finishes</li>
                  <li><strong>SF (Start-to-Finish):</strong> Task finishes when predecessor starts</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="guide-section">
            <h3>🔒 Task Constraints</h3>
            <div className="step">
              <div className="step-icon">
                <Settings size={20} />
              </div>
              <div className="step-content">
                <h4>Setting Task Constraints</h4>
                <p>In the task editor, use the <strong>"Task Constraint"</strong> section to control when tasks can start or finish. These constraints are fully compatible with MS Project.</p>
                <ul>
                  <li><strong>As Soon As Possible (ASAP):</strong> Default - schedule task as early as possible</li>
                  <li><strong>As Late As Possible (ALAP):</strong> Schedule task as late as possible without delaying successors</li>
                  <li><strong>Must Start/Finish On:</strong> Task must start or finish exactly on the specified date</li>
                  <li><strong>Start/Finish No Earlier Than:</strong> Task cannot start or finish before the specified date</li>
                  <li><strong>Start/Finish No Later Than:</strong> Task must start or finish by the specified date</li>
                </ul>
                <p className="tip">💡 <strong>Tip:</strong> Use constraints to enforce external deadlines, permit requirements, or material delivery dates.</p>
              </div>
            </div>
          </section>

          <section className="guide-section">
            <h3>🤖 AI-Powered Features</h3>
            
            <div className="step">
              <div className="step-icon">
                <Sparkles size={20} />
              </div>
              <div className="step-content">
                <h4>AI Task Assistance</h4>
                <p>When editing a task, use the AI helper buttons to:</p>
                <ul>
                  <li><strong>Estimate Duration:</strong> AI suggests realistic task duration based on the task name and type</li>
                  <li><strong>Categorize Task:</strong> AI automatically categorizes tasks into construction phases</li>
                  <li><strong>Detect Dependencies:</strong> AI suggests which tasks should be predecessors</li>
                </ul>
              </div>
            </div>

            <div className="step">
              <div className="step-icon">
                <MessageCircle size={20} />
              </div>
              <div className="step-content">
                <h4>AI Chat Assistant</h4>
                <p>Click <strong>"AI Chat"</strong> in the header to open the AI assistant. Ask questions about your project, get optimization suggestions, or request help with scheduling.</p>
                <p className="tip">💡 <strong>Tip:</strong> Try asking "How can I reduce my project duration?" or "What are the critical path tasks?"</p>
              </div>
            </div>
          </section>

          <section className="guide-section">
            <h3>✅ Validation & Export</h3>
            
            <div className="step">
              <div className="step-icon">
                <CheckCircle size={20} />
              </div>
              <div className="step-content">
                <h4>Validate Project</h4>
                <p>Click <strong>"Validate"</strong> to check your project for errors such as circular dependencies, invalid dates, or missing required fields. Validation errors will be displayed in a panel below the header.</p>
              </div>
            </div>

            <div className="step">
              <div className="step-icon">
                <Download size={20} />
              </div>
              <div className="step-content">
                <h4>Export to MS Project</h4>
                <p>Click <strong>"Export XML"</strong> to download your project as an MS Project XML file. The tool will validate your project first and warn you of any issues before exporting.</p>
              </div>
            </div>
          </section>

          <section className="guide-section">
            <h3>⚙️ Project Settings</h3>
            <div className="step">
              <div className="step-icon">
                <Settings size={20} />
              </div>
              <div className="step-content">
                <h4>Edit Project Metadata</h4>
                <p>Click the <strong>settings icon</strong> next to the project name to edit project-level information such as project name, start date, and status date.</p>
              </div>
            </div>
          </section>

          <section className="guide-section">
            <h3>📊 Baseline Management</h3>
            <div className="step">
              <div className="step-icon">
                <GitBranch size={20} />
              </div>
              <div className="step-content">
                <h4>Set and Track Baselines</h4>
                <p>Baselines allow you to save a snapshot of your schedule to compare against actual progress. This is essential for tracking schedule variance.</p>
                <ul>
                  <li><strong>Set Baseline:</strong> Click the <GitBranch size={14} style={{display: 'inline', verticalAlign: 'middle'}} /> icon next to the project name to open Baseline Manager. Select a baseline number (0-10) and click "Set" to capture the current schedule.</li>
                  <li><strong>View Baselines:</strong> In the Gantt chart, use the "Show Baselines" toggle to display baseline bars below the current task bars. Grey bars show the original baseline schedule.</li>
                  <li><strong>Compare Schedules:</strong> When baselines are visible, you can easily see if tasks have slipped (current bar is to the right of baseline) or are ahead of schedule.</li>
                  <li><strong>Clear Baseline:</strong> Remove a baseline by clicking the trash icon in Baseline Manager.</li>
                </ul>
                <p className="tip">💡 <strong>Tip:</strong> MS Project supports 11 baselines (0-10). Baseline 0 is the primary baseline. Use additional baselines to track schedule changes over time.</p>
              </div>
            </div>
          </section>

          <section className="guide-section tips-section">
            <h3>💡 Pro Tips</h3>
            <ul className="tips-list">
              <li>Use the Gantt chart to visualize task timelines and dependencies</li>
              <li>Task bars in the Gantt chart are color-coded by category</li>
              <li>Dependency arrows show the relationship between tasks</li>
              <li>The project duration is automatically calculated based on tasks and dependencies</li>
              <li>All AI processing happens locally - your data never leaves your machine</li>
              <li>Save your work by exporting to XML regularly</li>
              <li>Set a baseline before starting your project to track schedule variance</li>
              <li>Use the baseline toggle in the Gantt chart to compare current vs. planned schedules</li>
            </ul>
          </section>

          <section className="guide-section">
            <h3>🆘 Need Help?</h3>
            <p>If you encounter any issues or have questions:</p>
            <ul className="tips-list">
              <li>Try the <strong>AI Chat</strong> for project-specific help</li>
              <li>Check the validation panel for error details</li>
              <li>Ensure all required fields are filled in before exporting</li>
              <li>Refer to the documentation for advanced features</li>
            </ul>
          </section>
        </div>

        <div className="modal-footer">
          <button className="action-button primary" onClick={onClose}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}

