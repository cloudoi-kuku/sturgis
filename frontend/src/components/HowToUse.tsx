import { useState } from 'react';
import {
  X, Upload, Plus, CheckCircle, Download, MessageCircle,
  Sparkles, GitBranch, Settings, Search, BookOpen, Zap, Calendar,
  Clock, Target, HelpCircle, ChevronRight, Command, Bot, Layers,
  FileText, AlertTriangle, Lightbulb, Play, RefreshCw, Save,
  BarChart3, Users, FolderOpen, ArrowRightLeft, Milestone
} from 'lucide-react';
import './HowToUse.css';

interface HowToUseProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'quickstart' | 'projects' | 'tasks' | 'ai' | 'commands' | 'advanced' | 'faq';

interface TabInfo {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabInfo[] = [
  { id: 'quickstart', label: 'Quick Start', icon: <Play size={18} /> },
  { id: 'projects', label: 'Projects', icon: <FolderOpen size={18} /> },
  { id: 'tasks', label: 'Tasks', icon: <Layers size={18} /> },
  { id: 'ai', label: 'AI Features', icon: <Bot size={18} /> },
  { id: 'commands', label: 'AI Commands', icon: <Command size={18} /> },
  { id: 'advanced', label: 'Advanced', icon: <Settings size={18} /> },
  { id: 'faq', label: 'FAQ', icon: <HelpCircle size={18} /> },
];

export function HowToUse({ isOpen, onClose }: HowToUseProps) {
  const [activeTab, setActiveTab] = useState<TabId>('quickstart');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const renderQuickStart = () => (
    <div className="help-tab-content">
      <div className="welcome-banner">
        <div className="welcome-icon">
          <Zap size={48} />
        </div>
        <div className="welcome-text">
          <h3>Welcome to Sturgis Project Manager</h3>
          <p>A powerful construction project management tool with AI-powered features for scheduling, task management, and MS Project compatibility.</p>
        </div>
      </div>

      <div className="quick-steps">
        <h4>Get Started in 3 Steps</h4>
        <div className="steps-grid">
          <div className="quick-step">
            <div className="step-number">1</div>
            <div className="step-info">
              <h5><Upload size={16} /> Upload or Create</h5>
              <p>Upload an MS Project XML file or create a new project from scratch</p>
            </div>
          </div>
          <div className="quick-step">
            <div className="step-number">2</div>
            <div className="step-info">
              <h5><Plus size={16} /> Add Tasks</h5>
              <p>Create tasks, set durations, and define dependencies</p>
            </div>
          </div>
          <div className="quick-step">
            <div className="step-number">3</div>
            <div className="step-info">
              <h5><Download size={16} /> Export</h5>
              <p>Export your project back to MS Project XML format</p>
            </div>
          </div>
        </div>
      </div>

      <div className="feature-highlights">
        <h4>Key Features</h4>
        <div className="features-grid">
          <div className="feature-card">
            <Bot className="feature-icon" />
            <h5>AI-Powered</h5>
            <p>Natural language commands, duration estimation, and smart suggestions</p>
          </div>
          <div className="feature-card">
            <BarChart3 className="feature-icon" />
            <h5>Gantt Chart</h5>
            <p>Interactive visualization with drag-and-drop support</p>
          </div>
          <div className="feature-card">
            <GitBranch className="feature-icon" />
            <h5>Dependencies</h5>
            <p>Full support for FS, SS, FF, SF relationships with lag</p>
          </div>
          <div className="feature-card">
            <Target className="feature-icon" />
            <h5>Critical Path</h5>
            <p>Automatic critical path calculation and optimization</p>
          </div>
          <div className="feature-card">
            <Calendar className="feature-icon" />
            <h5>Baselines</h5>
            <p>Track schedule variance with up to 11 baselines</p>
          </div>
          <div className="feature-card">
            <FileText className="feature-icon" />
            <h5>MS Project</h5>
            <p>Full XML import/export compatibility</p>
          </div>
        </div>
      </div>

      <div className="keyboard-shortcuts">
        <h4><Command size={18} /> Keyboard Shortcuts</h4>
        <div className="shortcuts-grid">
          <div className="shortcut"><kbd>Ctrl</kbd> + <kbd>N</kbd> <span>New Task</span></div>
          <div className="shortcut"><kbd>Ctrl</kbd> + <kbd>S</kbd> <span>Save Project</span></div>
          <div className="shortcut"><kbd>Ctrl</kbd> + <kbd>E</kbd> <span>Export XML</span></div>
          <div className="shortcut"><kbd>Esc</kbd> <span>Close Modal</span></div>
          <div className="shortcut"><kbd>?</kbd> <span>Open Help</span></div>
          <div className="shortcut"><kbd>Ctrl</kbd> + <kbd>K</kbd> <span>AI Chat</span></div>
        </div>
      </div>
    </div>
  );

  const renderProjects = () => (
    <div className="help-tab-content">
      <section className="help-section">
        <h3><FolderOpen size={22} /> Project Management</h3>

        <div className="help-card">
          <div className="card-header">
            <Plus size={20} />
            <h4>Create New Project</h4>
          </div>
          <div className="card-body">
            <p>Click <strong>"New Project"</strong> in the header to create a blank project. You can also use AI to generate a complete project from a description.</p>
            <div className="example-box">
              <strong>AI Project Generation:</strong>
              <p>In the AI Chat, describe your project and it will generate tasks automatically:</p>
              <code>"Create a 3-story office building project with 50,000 sq ft"</code>
            </div>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <Upload size={20} />
            <h4>Import from MS Project</h4>
          </div>
          <div className="card-body">
            <p>Click <strong>"Upload XML"</strong> to import an existing MS Project file (.xml or .mspdi format).</p>
            <ul>
              <li>All tasks, dependencies, and constraints are preserved</li>
              <li>Calendar settings are imported</li>
              <li>Baseline data is maintained</li>
            </ul>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <ArrowRightLeft size={20} />
            <h4>Switch Between Projects</h4>
          </div>
          <div className="card-body">
            <p>Use the project dropdown in the header to switch between saved projects. All your projects are stored in the database and persist between sessions.</p>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <Settings size={20} />
            <h4>Project Settings</h4>
          </div>
          <div className="card-body">
            <p>Click the <strong>settings icon</strong> next to the project name to edit:</p>
            <ul>
              <li><strong>Project Name:</strong> Update the project title</li>
              <li><strong>Start Date:</strong> Set when the project begins</li>
              <li><strong>Status Date:</strong> Current reporting date for progress tracking</li>
            </ul>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <Download size={20} />
            <h4>Export to MS Project</h4>
          </div>
          <div className="card-body">
            <p>Click <strong>"Export XML"</strong> to download your project as an MS Project compatible file (.mspdi).</p>
            <div className="info-box">
              <AlertTriangle size={16} />
              <span>The project will be validated before export. Fix any errors shown in the validation panel first.</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderTasks = () => (
    <div className="help-tab-content">
      <section className="help-section">
        <h3><Layers size={22} /> Task Management</h3>

        <div className="help-card">
          <div className="card-header">
            <Plus size={20} />
            <h4>Creating Tasks</h4>
          </div>
          <div className="card-body">
            <p>Click <strong>"New Task"</strong> or use <kbd>Ctrl</kbd>+<kbd>N</kbd> to add a new task.</p>
            <h5>Task Properties:</h5>
            <ul>
              <li><strong>Name:</strong> Descriptive task title</li>
              <li><strong>Duration:</strong> Estimated working days (8 hours = 1 day)</li>
              <li><strong>Outline Number:</strong> Hierarchical position (e.g., 1.2.3)</li>
              <li><strong>Milestone:</strong> Mark as milestone (0 duration checkpoint)</li>
              <li><strong>Progress:</strong> Percentage complete (0-100%)</li>
            </ul>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <GitBranch size={20} />
            <h4>Dependencies (Predecessors)</h4>
          </div>
          <div className="card-body">
            <p>Define which tasks must complete before others can start:</p>
            <div className="dependency-types">
              <div className="dep-type">
                <span className="dep-badge fs">FS</span>
                <div>
                  <strong>Finish-to-Start</strong>
                  <p>Task starts when predecessor finishes (most common)</p>
                </div>
              </div>
              <div className="dep-type">
                <span className="dep-badge ss">SS</span>
                <div>
                  <strong>Start-to-Start</strong>
                  <p>Task starts when predecessor starts</p>
                </div>
              </div>
              <div className="dep-type">
                <span className="dep-badge ff">FF</span>
                <div>
                  <strong>Finish-to-Finish</strong>
                  <p>Task finishes when predecessor finishes</p>
                </div>
              </div>
              <div className="dep-type">
                <span className="dep-badge sf">SF</span>
                <div>
                  <strong>Start-to-Finish</strong>
                  <p>Task finishes when predecessor starts</p>
                </div>
              </div>
            </div>
            <div className="tip-box">
              <Lightbulb size={16} />
              <span><strong>Lag Time:</strong> Add delay between tasks (e.g., 2-day concrete curing time)</span>
            </div>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <Clock size={20} />
            <h4>Task Constraints</h4>
          </div>
          <div className="card-body">
            <p>Control when tasks can be scheduled:</p>
            <table className="constraints-table">
              <thead>
                <tr>
                  <th>Constraint</th>
                  <th>Description</th>
                  <th>Use Case</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>ASAP</strong></td>
                  <td>As Soon As Possible</td>
                  <td>Default - schedule as early as possible</td>
                </tr>
                <tr>
                  <td><strong>ALAP</strong></td>
                  <td>As Late As Possible</td>
                  <td>Delay without affecting successors</td>
                </tr>
                <tr>
                  <td><strong>MSO</strong></td>
                  <td>Must Start On</td>
                  <td>Fixed start date (e.g., inspection)</td>
                </tr>
                <tr>
                  <td><strong>MFO</strong></td>
                  <td>Must Finish On</td>
                  <td>Fixed end date (e.g., deadline)</td>
                </tr>
                <tr>
                  <td><strong>SNET</strong></td>
                  <td>Start No Earlier Than</td>
                  <td>Wait for material delivery</td>
                </tr>
                <tr>
                  <td><strong>SNLT</strong></td>
                  <td>Start No Later Than</td>
                  <td>Must begin by specific date</td>
                </tr>
                <tr>
                  <td><strong>FNET</strong></td>
                  <td>Finish No Earlier Than</td>
                  <td>Minimum duration requirement</td>
                </tr>
                <tr>
                  <td><strong>FNLT</strong></td>
                  <td>Finish No Later Than</td>
                  <td>Deadline constraint</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <Milestone size={20} />
            <h4>Milestones</h4>
          </div>
          <div className="card-body">
            <p>Milestones are zero-duration tasks that mark significant project events:</p>
            <ul>
              <li>Project kickoff / completion</li>
              <li>Phase completions</li>
              <li>Inspections and approvals</li>
              <li>Key deliverables</li>
            </ul>
            <div className="info-box">
              <AlertTriangle size={16} />
              <span>Milestones must have 0 duration. The system will reject milestones with duration &gt; 0.</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderAI = () => (
    <div className="help-tab-content">
      <section className="help-section">
        <h3><Bot size={22} /> AI-Powered Features</h3>

        <div className="ai-status-banner">
          <Sparkles size={24} />
          <div>
            <strong>AI Service Status</strong>
            <p>AI features are powered by Azure OpenAI or local Ollama. Check the AI Health indicator in the header.</p>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <MessageCircle size={20} />
            <h4>AI Chat Assistant</h4>
          </div>
          <div className="card-body">
            <p>Click <strong>"AI Chat"</strong> in the header to open the AI assistant. You can:</p>
            <ul>
              <li>Ask questions about your project</li>
              <li>Get optimization suggestions</li>
              <li>Execute commands using natural language</li>
              <li>Generate project content from descriptions</li>
            </ul>
            <div className="example-box">
              <strong>Example Conversations:</strong>
              <ul>
                <li>"What's the current project duration?"</li>
                <li>"Which tasks are on the critical path?"</li>
                <li>"How can I reduce the project timeline?"</li>
                <li>"Set task 1.2 duration to 5 days"</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <Clock size={20} />
            <h4>Duration Estimation</h4>
          </div>
          <div className="card-body">
            <p>AI can estimate realistic durations for construction tasks based on:</p>
            <ul>
              <li>Task name and type analysis</li>
              <li>Similar tasks in your project</li>
              <li>Industry standard timeframes</li>
              <li>Construction best practices</li>
            </ul>
            <p>In the task editor, click <strong>"Estimate Duration"</strong> to get AI suggestions with confidence levels.</p>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <Layers size={20} />
            <h4>Task Categorization</h4>
          </div>
          <div className="card-body">
            <p>AI automatically categorizes tasks into construction phases:</p>
            <div className="category-grid">
              <span className="category-badge site">Site Work</span>
              <span className="category-badge foundation">Foundation</span>
              <span className="category-badge structural">Structural</span>
              <span className="category-badge exterior">Exterior</span>
              <span className="category-badge mechanical">MEP</span>
              <span className="category-badge interior">Interior</span>
              <span className="category-badge finishing">Finishing</span>
              <span className="category-badge inspection">Inspection</span>
            </div>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <GitBranch size={20} />
            <h4>Dependency Detection</h4>
          </div>
          <div className="card-body">
            <p>AI analyzes your task list and suggests logical dependencies based on construction sequencing rules:</p>
            <ul>
              <li>Foundation before framing</li>
              <li>Rough-in before finishes</li>
              <li>Inspections after work completion</li>
              <li>Permits before related work</li>
            </ul>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <RefreshCw size={20} />
            <h4>Project Optimization</h4>
          </div>
          <div className="card-body">
            <p>AI can suggest ways to optimize your project schedule:</p>
            <ul>
              <li><strong>Lag Reduction:</strong> Reduce buffer time between tasks</li>
              <li><strong>Task Compression:</strong> Shorten critical path tasks</li>
              <li><strong>Auto-Sequencing:</strong> Reorder tasks by construction logic</li>
              <li><strong>Dependency Updates:</strong> Fix or suggest missing dependencies</li>
            </ul>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <Sparkles size={20} />
            <h4>AI Project Generation</h4>
          </div>
          <div className="card-body">
            <p>Generate complete project schedules from natural language descriptions:</p>
            <div className="example-box">
              <strong>Example:</strong>
              <code>"Generate a residential home construction project, 2500 sq ft, 2-story with basement, including all MEP work"</code>
              <p>AI will create 30-50 tasks with proper hierarchy, durations, and dependencies.</p>
            </div>
            <div className="info-box">
              <AlertTriangle size={16} />
              <span>Project generation works best with Azure OpenAI. Local models may have limited capabilities.</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderCommands = () => (
    <div className="help-tab-content">
      <section className="help-section">
        <h3><Command size={22} /> AI Chat Commands</h3>
        <p className="section-intro">Use natural language in the AI Chat to modify your project. Here are the supported commands:</p>

        <div className="commands-category">
          <h4><Clock size={18} /> Duration Commands</h4>
          <div className="command-list">
            <div className="command-item">
              <code>set task 1.2 duration to 5 days</code>
              <span>Change task duration</span>
            </div>
            <div className="command-item">
              <code>change task 1.3.1 to 10 days</code>
              <span>Alternative syntax</span>
            </div>
            <div className="command-item">
              <code>compress project to 90 days</code>
              <span>Scale all tasks proportionally</span>
            </div>
            <div className="command-item">
              <code>add 20% buffer to all tasks</code>
              <span>Increase all durations by percentage</span>
            </div>
          </div>
        </div>

        <div className="commands-category">
          <h4><ArrowRightLeft size={18} /> Lag Commands</h4>
          <div className="command-list">
            <div className="command-item">
              <code>set task 1.2 lag to 3 days</code>
              <span>Add lag to predecessor</span>
            </div>
            <div className="command-item">
              <code>add 2 days lag to task 1.3</code>
              <span>Alternative syntax</span>
            </div>
            <div className="command-item">
              <code>remove lag from task 1.2</code>
              <span>Clear all lag values</span>
            </div>
          </div>
        </div>

        <div className="commands-category">
          <h4><Calendar size={18} /> Date & Constraint Commands</h4>
          <div className="command-list">
            <div className="command-item">
              <code>set project start date to 2025-03-01</code>
              <span>Change project start</span>
            </div>
            <div className="command-item">
              <code>set task 1.2 constraint to must start on 2025-04-15</code>
              <span>Set MSO constraint</span>
            </div>
            <div className="command-item">
              <code>set task 1.3 to start no earlier than 2025-05-01</code>
              <span>Set SNET constraint</span>
            </div>
            <div className="command-item">
              <code>set task 1.4 constraint to as soon as possible</code>
              <span>Set ASAP constraint</span>
            </div>
          </div>
        </div>

        <div className="commands-category">
          <h4><Layers size={18} /> Task Editing Commands</h4>
          <div className="command-list">
            <div className="command-item">
              <code>move task 1.2 after 1.3</code>
              <span>Reorder tasks</span>
            </div>
            <div className="command-item">
              <code>move task 1.2 under 2</code>
              <span>Make task a child of another</span>
            </div>
            <div className="command-item">
              <code>delete task 1.4</code>
              <span>Remove a task</span>
            </div>
            <div className="command-item">
              <code>insert task 'Site Prep' after 1.1</code>
              <span>Add new task</span>
            </div>
            <div className="command-item">
              <code>merge tasks 1.2 and 1.3</code>
              <span>Combine two tasks</span>
            </div>
          </div>
        </div>

        <div className="commands-category">
          <h4><RefreshCw size={18} /> Optimization Commands</h4>
          <div className="command-list">
            <div className="command-item">
              <code>auto sequence all tasks</code>
              <span>Reorder by construction logic</span>
            </div>
            <div className="command-item">
              <code>update all dependencies</code>
              <span>AI-suggested dependencies</span>
            </div>
            <div className="command-item">
              <code>reorganize phase 2</code>
              <span>Optimize specific phase</span>
            </div>
            <div className="command-item">
              <code>suggest improvements</code>
              <span>Get AI recommendations</span>
            </div>
          </div>
        </div>

        <div className="commands-category">
          <h4><HelpCircle size={18} /> Question Commands</h4>
          <div className="command-list">
            <div className="command-item">
              <code>what is the project duration?</code>
              <span>Get project info</span>
            </div>
            <div className="command-item">
              <code>which tasks are on the critical path?</code>
              <span>Critical path analysis</span>
            </div>
            <div className="command-item">
              <code>what's out of sequence?</code>
              <span>Find sequencing issues</span>
            </div>
            <div className="command-item">
              <code>analyze the project</code>
              <span>Full project review</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderAdvanced = () => (
    <div className="help-tab-content">
      <section className="help-section">
        <h3><Settings size={22} /> Advanced Features</h3>

        <div className="help-card">
          <div className="card-header">
            <Target size={20} />
            <h4>Critical Path Analysis</h4>
          </div>
          <div className="card-body">
            <p>The critical path shows the longest sequence of dependent tasks that determines the minimum project duration.</p>
            <ul>
              <li><strong>Critical Tasks:</strong> Tasks with zero float (no scheduling flexibility)</li>
              <li><strong>Float/Slack:</strong> How much a task can slip without affecting the project end date</li>
              <li><strong>Early/Late Dates:</strong> Earliest and latest possible start/finish dates</li>
            </ul>
            <p>View critical path by clicking <strong>"Critical Path"</strong> in the toolbar. Critical tasks are highlighted in red.</p>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <Save size={20} />
            <h4>Baseline Management</h4>
          </div>
          <div className="card-body">
            <p>Baselines capture a snapshot of your schedule for comparison:</p>
            <ul>
              <li><strong>Set Baseline:</strong> Save current schedule (supports baselines 0-10)</li>
              <li><strong>View Baselines:</strong> Toggle baseline bars in Gantt chart</li>
              <li><strong>Compare:</strong> See schedule variance (slippage or ahead of schedule)</li>
              <li><strong>Clear Baseline:</strong> Remove baseline data</li>
            </ul>
            <div className="tip-box">
              <Lightbulb size={16} />
              <span>Set Baseline 0 before starting your project. Use additional baselines to track re-baselines.</span>
            </div>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <Calendar size={20} />
            <h4>Calendar Management</h4>
          </div>
          <div className="card-body">
            <p>Configure working time settings:</p>
            <ul>
              <li><strong>Work Week:</strong> Define which days are working days (default: Mon-Fri)</li>
              <li><strong>Hours per Day:</strong> Working hours (default: 8 hours)</li>
              <li><strong>Exceptions:</strong> Add holidays or special non-working days</li>
            </ul>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <CheckCircle size={20} />
            <h4>Project Validation</h4>
          </div>
          <div className="card-body">
            <p>The system validates your project for:</p>
            <ul>
              <li>Circular dependencies (task depends on itself)</li>
              <li>Invalid predecessor references</li>
              <li>Milestones with non-zero duration</li>
              <li>Summary task direct duration changes</li>
              <li>Unreasonable lag values (&gt;2 years)</li>
              <li>Missing constraint dates</li>
            </ul>
            <p>Click <strong>"Validate"</strong> to check your project before exporting.</p>
          </div>
        </div>

        <div className="help-card">
          <div className="card-header">
            <Users size={20} />
            <h4>Data Storage</h4>
          </div>
          <div className="card-body">
            <p>Your projects are automatically saved to the local database:</p>
            <ul>
              <li>All changes are saved automatically</li>
              <li>Projects persist between sessions</li>
              <li>Azure Blob Storage backup (if configured)</li>
              <li>Export XML for permanent backup</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );

  const renderFAQ = () => (
    <div className="help-tab-content">
      <section className="help-section">
        <h3><HelpCircle size={22} /> Frequently Asked Questions</h3>

        <div className="faq-list">
          <div className="faq-item">
            <div className="faq-question">
              <ChevronRight size={18} />
              <span>How do I import an MS Project file?</span>
            </div>
            <div className="faq-answer">
              Click <strong>"Upload XML"</strong> in the header and select your .xml or .mspdi file. All tasks, dependencies, and settings will be imported.
            </div>
          </div>

          <div className="faq-item">
            <div className="faq-question">
              <ChevronRight size={18} />
              <span>Why can't I change the duration of a summary task?</span>
            </div>
            <div className="faq-answer">
              Summary task durations are automatically calculated from their child tasks. To change the duration, modify the individual child tasks instead.
            </div>
          </div>

          <div className="faq-item">
            <div className="faq-question">
              <ChevronRight size={18} />
              <span>What's the difference between lag and lead?</span>
            </div>
            <div className="faq-answer">
              <strong>Lag</strong> is a delay between tasks (positive value). <strong>Lead</strong> is an overlap (negative lag value). For example, a 2-day lag means wait 2 days after the predecessor finishes before starting.
            </div>
          </div>

          <div className="faq-item">
            <div className="faq-question">
              <ChevronRight size={18} />
              <span>How does the AI estimate task durations?</span>
            </div>
            <div className="faq-answer">
              The AI analyzes the task name, compares it to similar tasks in your project, and applies construction industry standards. It provides a confidence score to indicate reliability.
            </div>
          </div>

          <div className="faq-item">
            <div className="faq-question">
              <ChevronRight size={18} />
              <span>Can I use this offline?</span>
            </div>
            <div className="faq-answer">
              The core functionality works offline, but AI features require an active connection to the AI service (Azure OpenAI or local Ollama).
            </div>
          </div>

          <div className="faq-item">
            <div className="faq-question">
              <ChevronRight size={18} />
              <span>How do I set a baseline?</span>
            </div>
            <div className="faq-answer">
              Click the baseline icon (<GitBranch size={14} style={{display: 'inline', verticalAlign: 'middle'}} />) next to the project name. Select a baseline number (0-10) and click "Set Baseline". Toggle baseline visibility in the Gantt chart view options.
            </div>
          </div>

          <div className="faq-item">
            <div className="faq-question">
              <ChevronRight size={18} />
              <span>Why is my project not exporting?</span>
            </div>
            <div className="faq-answer">
              Projects must pass validation before export. Click "Validate" to see any errors. Common issues include circular dependencies, invalid predecessors, or milestones with duration.
            </div>
          </div>

          <div className="faq-item">
            <div className="faq-question">
              <ChevronRight size={18} />
              <span>How do I create hierarchical tasks (WBS)?</span>
            </div>
            <div className="faq-answer">
              Use outline numbers to create hierarchy. For example, task "1" is a parent, "1.1" and "1.2" are its children. Parent tasks automatically become summary tasks when they have children.
            </div>
          </div>

          <div className="faq-item">
            <div className="faq-question">
              <ChevronRight size={18} />
              <span>What AI commands can I use?</span>
            </div>
            <div className="faq-answer">
              Check the <strong>"AI Commands"</strong> tab for a complete list. You can set durations, add lag, change constraints, move tasks, and more using natural language.
            </div>
          </div>

          <div className="faq-item">
            <div className="faq-question">
              <ChevronRight size={18} />
              <span>Is my data secure?</span>
            </div>
            <div className="faq-answer">
              Your project data is stored locally in the application database. If Azure Storage is configured, backups are stored in your Azure account. Data is never shared with third parties.
            </div>
          </div>
        </div>

        <div className="help-footer">
          <div className="need-more-help">
            <BookOpen size={24} />
            <div>
              <h4>Need More Help?</h4>
              <p>Try the AI Chat for project-specific assistance, or check the validation panel for error details.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'quickstart': return renderQuickStart();
      case 'projects': return renderProjects();
      case 'tasks': return renderTasks();
      case 'ai': return renderAI();
      case 'commands': return renderCommands();
      case 'advanced': return renderAdvanced();
      case 'faq': return renderFAQ();
      default: return renderQuickStart();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-header">
          <div className="help-title">
            <BookOpen size={28} />
            <div>
              <h2>Help Center</h2>
              <p>Sturgis Project Manager Documentation</p>
            </div>
          </div>
          <div className="help-header-actions">
            <div className="help-search">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search help..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="close-button" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="help-body">
          <nav className="help-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="help-content">
            {renderContent()}
          </div>
        </div>

        <div className="help-modal-footer">
          <div className="footer-info">
            <span>Version 1.0.0</span>
            <span>•</span>
            <span>MS Project Compatible</span>
            <span>•</span>
            <span>AI-Powered</span>
          </div>
          <button className="primary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
