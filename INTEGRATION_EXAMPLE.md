# 🔌 How to Integrate AI Helper into Task Edit Dialog

## Quick Integration Guide

### Step 1: Import the AI Helper Component

In your task edit dialog component (e.g., `TaskEditDialog.tsx`):

```typescript
import { AITaskHelper } from './AITaskHelper';
```

### Step 2: Add State for AI Suggestions

```typescript
const [taskName, setTaskName] = useState('');
const [duration, setDuration] = useState(1);
const [category, setCategory] = useState('');
```

### Step 3: Add AI Helper to Your Form

```tsx
<div className="task-edit-form">
  {/* Existing task name input */}
  <div className="form-group">
    <label>Task Name</label>
    <input
      type="text"
      value={taskName}
      onChange={(e) => setTaskName(e.target.value)}
      placeholder="Enter task name..."
    />
  </div>

  {/* AI Helper Component - ADD THIS */}
  <AITaskHelper
    taskName={taskName}
    taskType={category}
    onDurationSuggest={(days) => {
      setDuration(days);
      // Optionally show a toast notification
      console.log(`AI suggested ${days} days`);
    }}
    onCategorySuggest={(cat) => {
      setCategory(cat);
      console.log(`AI suggested category: ${cat}`);
    }}
  />

  {/* Existing duration input */}
  <div className="form-group">
    <label>Duration (days)</label>
    <input
      type="number"
      value={duration}
      onChange={(e) => setDuration(Number(e.target.value))}
      min="0.5"
      step="0.5"
    />
  </div>

  {/* Rest of your form... */}
</div>
```

---

## Complete Example: Enhanced Task Edit Dialog

```tsx
import React, { useState } from 'react';
import { AITaskHelper } from './AITaskHelper';
import './TaskEditDialog.css';

interface TaskEditDialogProps {
  task?: Task;
  onSave: (task: Task) => void;
  onCancel: () => void;
}

export const TaskEditDialog: React.FC<TaskEditDialogProps> = ({
  task,
  onSave,
  onCancel
}) => {
  const [taskName, setTaskName] = useState(task?.name || '');
  const [duration, setDuration] = useState(task?.duration || 1);
  const [category, setCategory] = useState(task?.category || '');
  const [isMilestone, setIsMilestone] = useState(task?.milestone || false);

  const handleSave = () => {
    onSave({
      ...task,
      name: taskName,
      duration: `PT${duration * 8}H0M0S`, // Convert days to ISO format
      category,
      milestone: isMilestone
    });
  };

  return (
    <div className="task-edit-dialog">
      <div className="dialog-header">
        <h2>{task ? 'Edit Task' : 'Create Task'}</h2>
      </div>

      <div className="dialog-body">
        {/* Task Name */}
        <div className="form-group">
          <label>Task Name *</label>
          <input
            type="text"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            placeholder="e.g., Design database schema"
            autoFocus
          />
        </div>

        {/* AI Helper - The Magic! ✨ */}
        <AITaskHelper
          taskName={taskName}
          taskType={category}
          onDurationSuggest={(days) => {
            setDuration(days);
            // Optional: Show success toast
            showToast(`Duration set to ${days} days`);
          }}
          onCategorySuggest={(cat) => {
            setCategory(cat);
            showToast(`Category set to ${cat}`);
          }}
        />

        {/* Duration Input */}
        <div className="form-group">
          <label>Duration (days)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            min="0.5"
            step="0.5"
          />
          <span className="help-text">
            1 day = 8 hours of work
          </span>
        </div>

        {/* Category (optional - can be auto-filled by AI) */}
        <div className="form-group">
          <label>Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Select category...</option>
            <option value="design">🎨 Design</option>
            <option value="development">💻 Development</option>
            <option value="testing">🧪 Testing</option>
            <option value="documentation">📝 Documentation</option>
            <option value="deployment">🚀 Deployment</option>
            <option value="planning">📋 Planning</option>
          </select>
        </div>

        {/* Milestone Checkbox */}
        <div className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={isMilestone}
              onChange={(e) => setIsMilestone(e.target.checked)}
            />
            This is a milestone
          </label>
        </div>
      </div>

      <div className="dialog-footer">
        <button className="btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn-save"
          onClick={handleSave}
          disabled={!taskName.trim()}
        >
          Save Task
        </button>
      </div>
    </div>
  );
};

// Optional: Toast notification helper
function showToast(message: string) {
  // Implement your toast notification
  console.log('✓', message);
}
```

---

## Visual Flow

```
┌─────────────────────────────────────────────┐
│ Create Task                            [X]  │
├─────────────────────────────────────────────┤
│                                             │
│ Task Name *                                 │
│ ┌─────────────────────────────────────────┐ │
│ │ Design database schema                  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │  🤖 AI Suggest                          │ │ ← AI Helper Button
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 📊 Duration Estimate   [85% confident]  │ │
│ │                                         │ │
│ │ 2.5 days                                │ │ ← AI Suggestion
│ │                                         │ │
│ │ Database schema design typically...     │ │
│ │                                         │ │
│ │ [✓ Apply Duration]                      │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Duration (days)                             │
│ ┌─────────────────────────────────────────┐ │
│ │ 2.5                                     │ │ ← Auto-filled!
│ └─────────────────────────────────────────┘ │
│                                             │
│ Category                                    │
│ ┌─────────────────────────────────────────┐ │
│ │ 🎨 Design                               │ │ ← Auto-selected!
│ └─────────────────────────────────────────┘ │
│                                             │
│ ☐ This is a milestone                       │
│                                             │
├─────────────────────────────────────────────┤
│                    [Cancel]  [Save Task]    │
└─────────────────────────────────────────────┘
```

---

## Alternative: Inline AI Suggestions

For a more compact UI, you can show AI suggestions inline:

```tsx
<div className="form-group with-ai">
  <label>Duration (days)</label>
  <div className="input-with-ai">
    <input
      type="number"
      value={duration}
      onChange={(e) => setDuration(Number(e.target.value))}
    />
    <button
      className="ai-quick-suggest"
      onClick={async () => {
        const estimate = await estimateTaskDuration(taskName);
        setDuration(estimate.days);
      }}
      title="AI Suggest"
    >
      ✨
    </button>
  </div>
  {aiEstimate && (
    <div className="ai-hint">
      💡 AI suggests {aiEstimate.days} days ({aiEstimate.confidence}% confident)
    </div>
  )}
</div>
```

---

## Styling Tips

Add to your CSS:

```css
/* AI Helper Integration */
.form-group.with-ai {
  position: relative;
}

.input-with-ai {
  display: flex;
  gap: 8px;
}

.ai-quick-suggest {
  padding: 8px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: transform 0.2s;
}

.ai-quick-suggest:hover {
  transform: scale(1.1);
}

.ai-hint {
  margin-top: 6px;
  padding: 8px 12px;
  background: #f0f4ff;
  border-left: 3px solid #667eea;
  border-radius: 4px;
  font-size: 13px;
  color: #4a5568;
}
```

---

## Testing the Integration

1. **Start Ollama**:
   ```bash
   ollama serve
   ```

2. **Start Backend**:
   ```bash
   cd backend
   python main.py
   ```

3. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

4. **Test the Flow**:
   - Open task creation dialog
   - Type a task name: "Design user authentication flow"
   - Click "🤖 AI Suggest"
   - Watch AI provide duration and category
   - Click "✓ Apply Duration"
   - Save the task

---

## Error Handling

Add graceful fallbacks:

```tsx
<AITaskHelper
  taskName={taskName}
  taskType={category}
  onDurationSuggest={(days) => setDuration(days)}
  onCategorySuggest={(cat) => setCategory(cat)}
/>

{/* Show fallback message if AI is unavailable */}
{!aiAvailable && (
  <div className="ai-unavailable-notice">
    ℹ️ AI suggestions unavailable. Make sure Ollama is running.
    <a href="/docs/ai-setup">Setup Guide</a>
  </div>
)}
```

---

## That's It! 🎉

You now have AI-powered task creation with:
- ✅ Smart duration estimation
- ✅ Automatic categorization
- ✅ Beautiful UI integration
- ✅ 100% local and private
- ✅ Zero API costs

The AI helper seamlessly enhances your existing workflow without disrupting it!

