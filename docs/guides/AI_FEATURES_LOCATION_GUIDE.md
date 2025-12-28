# 📍 AI Features Location Guide

## Where to Find Each AI Feature

---

## 1. 🤖 AI Chat Assistant

### Location
```
┌─────────────────────────────────────────────────────────────┐
│  Project Configuration Tool                              │
├─────────────────────────────────────────────────────────────┤
│  [Upload XML] [Validate] [Export XML] [💬 AI Chat] ← HERE  │
└─────────────────────────────────────────────────────────────┘
```

### What It Looks Like
- **Button Text**: "AI Chat"
- **Icon**: 💬 (Message Circle)
- **Color**: Purple/Blue button
- **Location**: Top toolbar, far right side

### How to Use
1. Click the "AI Chat" button
2. Chat window slides in from the right
3. Type your message or command
4. Press Enter or click Send (➤)

### What You Can Do
**Ask Questions**:
- "What is the current project?"
- "What tasks have lags?"
- "How long should foundation work take?"

**Execute Commands**:
- "Change task 1.2 duration to 10 days"
- "Set lag for task 2.3 to 5 days"
- "Add 10% buffer to all tasks"

---

## 2. ✨ AI Task Helper (Duration Estimation)

### Location
```
┌─────────────────────────────────────────────────────────────┐
│  Task Editor                                          [X]   │
├─────────────────────────────────────────────────────────────┤
│  Task Name: [Pour foundation concrete____________]         │
│                                                             │
│  [✨ AI Suggest] ← HERE                                     │
│                                                             │
│  Duration: [___] days                                       │
│  Outline: [___]                                             │
└─────────────────────────────────────────────────────────────┘
```

### What It Looks Like
- **Button Text**: "AI Suggest"
- **Icon**: ✨ (Sparkles)
- **Location**: Inside Task Editor, below Task Name field
- **Only appears for**: Regular tasks (not summaries or milestones)

### How to Use
1. Click "Add Task" or edit an existing task
2. Enter a task name (e.g., "Install HVAC system")
3. Click "AI Suggest" button
4. Wait 2-5 seconds for AI analysis
5. Review suggestions:
   - Duration estimate (e.g., "5 days")
   - Category (e.g., "mechanical")
   - Confidence scores
6. Click "Apply Duration" to use the suggestion

### What You Get
```
┌─────────────────────────────────────────────────────────────┐
│  📊 Duration Estimate                    85% confident      │
│  5 days                                                     │
│  "HVAC installation typically requires 3-7 days..."        │
│  [✓ Apply Duration]                                         │
├─────────────────────────────────────────────────────────────┤
│  🏷️ Category                             90% confident      │
│  ⚡ mechanical                                               │
│  [✓ Apply Category]                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 🎯 Critical Path Visualization

### Location
```
┌─────────────────────────────────────────────────────────────┐
│  Gantt Chart                                                │
├─────────────────────────────────────────────────────────────┤
│  [View Critical Path] ← Button in Gantt Chart area          │
└─────────────────────────────────────────────────────────────┘
```

### What It Does
- Calculates critical path using AI
- Highlights tasks that affect project end date
- Shows total project duration

---

## 4. 🔧 AI Optimization (API Only)

### Available Endpoints
These are available via API but not yet in the UI:

**Optimize Project Duration**:
```bash
POST /api/ai/optimize-duration
{
  "target_days": 180
}
```

**Detect Dependencies**:
```bash
POST /api/ai/detect-dependencies
{
  "tasks": [...]
}
```

---

## 🎨 Visual Reference

### Main Application Layout
```
┌───────────────────────────────────────────────────────────────┐
│  Project Configuration Tool                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ [Upload] [Validate] [Export] [💬 AI Chat] ← AI BUTTON  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Project: 23-038 Boone                                        │
│  Start: 2024-01-01 | Status: 2024-01-01 | 282 tasks          │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Gantt Chart                                            │  │
│  │  [Task List]                    [Timeline View]         │  │
│  │                                                         │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### AI Chat Window (When Open)
```
┌───────────────────────────────────────────────────────────────┐
│  Main App                                                     │
│                                    ┌────────────────────────┐ │
│                                    │ 🤖 AI Project Assistant│ │
│                                    │ [🗑️] [X]              │ │
│                                    ├────────────────────────┤ │
│                                    │ 🤖 Hi! I'm your AI...  │ │
│                                    │                        │ │
│                                    │ 👤 What is the current │ │
│                                    │    project?            │ │
│                                    │                        │ │
│                                    │ 🤖 The current project │ │
│                                    │    is 23-038 Boone...  │ │
│                                    ├────────────────────────┤ │
│                                    │ [Type message...] [➤] │ │
│                                    └────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### Task Editor with AI Suggest
```
┌─────────────────────────────────────────────────────────────┐
│  Task Editor                                          [X]   │
├─────────────────────────────────────────────────────────────┤
│  Task Name: [Install HVAC system_________________]         │
│                                                             │
│  [✨ AI Suggest] ← Click this                               │
│                                                             │
│  ↓ After clicking, suggestions appear:                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📊 Duration Estimate              85% confident     │   │
│  │ 5 days                                              │   │
│  │ "HVAC installation typically requires..."          │   │
│  │ [✓ Apply Duration]                                  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 🏷️ Category                       90% confident     │   │
│  │ ⚡ mechanical                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Duration: [5___] days ← Auto-filled if you click Apply    │
│  Outline: [___]                                             │
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 How to Verify AI Features Are Working

### Check 1: AI Chat Button Exists
1. Open http://localhost:5174
2. Look at the top toolbar
3. You should see: `[Upload XML] [Validate] [Export XML] [💬 AI Chat]`
4. If you don't see it, check browser console (F12) for errors

### Check 2: AI Chat Opens
1. Click the "AI Chat" button
2. A chat window should slide in from the right
3. You should see a welcome message
4. If nothing happens, check browser console (F12)

### Check 3: AI Chat Responds
1. Type: "Hello"
2. Press Enter
3. Wait 2-5 seconds
4. You should see a response from the AI
5. If no response, check Network tab (F12) for failed requests

### Check 4: AI Task Helper Exists
1. Click "Add Task" button
2. Task Editor modal opens
3. Enter task name: "Pour concrete"
4. Look for "AI Suggest" button with sparkles icon
5. If you don't see it, the task might be a summary/milestone

### Check 5: AI Task Helper Works
1. Click "AI Suggest" button
2. Button text changes to "Analyzing..."
3. Wait 2-5 seconds
4. Suggestion cards appear below
5. If nothing happens, check browser console (F12)

---

## 🆘 Troubleshooting Checklist

- [ ] Frontend is running (http://localhost:5174)
- [ ] Backend is running (http://localhost:8000)
- [ ] Ollama is running (http://localhost:11434)
- [ ] AI Chat button is visible in toolbar
- [ ] Clicking AI Chat opens the chat window
- [ ] Can send messages in chat
- [ ] AI responds to messages
- [ ] AI Task Helper button appears in Task Editor
- [ ] Clicking AI Suggest shows suggestions
- [ ] No errors in browser console (F12)

---

## 📞 Need Help?

If you still can't find or use the AI features:

1. **Take a screenshot** of your screen
2. **Open browser console** (F12) and copy any errors
3. **Describe what you see** vs. what you expect to see
4. **Share the information** so I can help debug

The AI features are definitely implemented and working on the backend. If you can't see them, it's likely a frontend display issue that we can fix!

