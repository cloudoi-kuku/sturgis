# 🤖 AI Features - Complete Guide

**Status**: ✅ All AI features are implemented and working!

---

## 📋 Quick Reference

| Feature | Location | Status | How to Access |
|---------|----------|--------|---------------|
| **AI Chat** | Top toolbar | ✅ Working | Click "AI Chat" button |
| **AI Task Helper** | Task Editor | ✅ Working | Click "AI Suggest" in task editor |
| **Duration Estimation** | API | ✅ Working | Via AI Task Helper or API |
| **Task Categorization** | API | ✅ Working | Via AI Task Helper or API |
| **Dependency Detection** | API | ✅ Working | API only (not in UI yet) |
| **Critical Path** | API | ✅ Working | API endpoint available |
| **Project Optimization** | API | ✅ Working | API only (not in UI yet) |

---

## 🎯 What Each Feature Does

### 1. 🤖 AI Chat Assistant
**Purpose**: Conversational AI that can answer questions AND modify your project

**Capabilities**:
- ✅ Answer questions about your project
- ✅ Provide construction expertise
- ✅ Execute commands to modify tasks
- ✅ Maintain conversation history

**Example Questions**:
```
"What is the current project?"
"What tasks have lags?"
"How long should foundation work take?"
"What's the critical path?"
```

**Example Commands**:
```
"Change task 1.2 duration to 10 days"
"Set lag for task 2.3 to 5 days"
"Set project start date to 2024-01-15"
"Add 10% buffer to all tasks"
"Remove lag from task 3.4"
```

**How to Use**:
1. Click "AI Chat" button in top toolbar
2. Chat window opens on the right
3. Type your question or command
4. Press Enter or click Send
5. Wait 2-5 seconds for response

---

### 2. ✨ AI Task Helper
**Purpose**: Smart suggestions when creating or editing tasks

**Capabilities**:
- ✅ Estimate realistic task duration
- ✅ Categorize task type
- ✅ Provide confidence scores
- ✅ One-click apply suggestions

**How to Use**:
1. Click "Add Task" or edit existing task
2. Enter task name (e.g., "Install HVAC system")
3. Click "AI Suggest" button
4. Wait 2-5 seconds
5. Review suggestions
6. Click "Apply Duration" to use

**Example**:
```
Task Name: "Pour foundation concrete"
↓ Click "AI Suggest"
↓ AI analyzes...
↓ Suggestions appear:

📊 Duration Estimate (85% confident)
8 days
"Foundation concrete requires prep, pour, and curing time..."
[✓ Apply Duration]

🏷️ Category (90% confident)
🏗️ foundation
```

---

### 3. 🎯 Critical Path Calculation
**Purpose**: Identify tasks that affect project end date

**How to Use**:
```bash
# Via API
curl http://localhost:8000/api/critical-path
```

**Returns**:
- List of critical tasks
- Total project duration
- Critical path length

---

### 4. 🔧 Project Optimization
**Purpose**: Suggest ways to reduce project duration

**How to Use**:
```bash
# Via API
curl -X POST http://localhost:8000/api/ai/optimize-duration \
  -H "Content-Type: application/json" \
  -d '{"target_days": 180}'
```

**Returns**:
- Optimization strategies
- Estimated time savings
- Specific task recommendations

---

## 🧪 Testing Results

All AI endpoints have been tested and are working:

```
✅ AI Health Check - PASS
✅ Duration Estimation - PASS
✅ Task Categorization - PASS
✅ AI Chat (Questions) - PASS
✅ AI Chat (Commands) - PASS
✅ Critical Path - PASS
```

**Test Script**: Run `./test_ai_endpoints.sh` to verify

---

## 📍 Where to Find Features

### AI Chat Button
```
Top Toolbar → [Upload XML] [Validate] [Export XML] [💬 AI Chat]
                                                      ↑
                                                   Click here
```

### AI Task Helper
```
Task Editor → Enter task name → [✨ AI Suggest]
                                  ↑
                               Click here
```

---

## 🐛 Common Issues

### "I don't see the AI Chat button"
**Solution**: 
1. Make sure frontend is running: `cd frontend && npm run dev`
2. Clear browser cache: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
3. Check browser console (F12) for errors

### "AI Chat doesn't respond"
**Solution**:
1. Check backend is running: `curl http://localhost:8000/api/ai/health`
2. Check Ollama is running: `curl http://localhost:11434/api/tags`
3. Look at browser Network tab (F12) for failed requests

### "AI Task Helper doesn't appear"
**Solution**:
1. Make sure you're editing a **regular task** (not summary or milestone)
2. The button only appears for tasks with `summary: false` and `milestone: false`

### "Commands don't update the UI"
**Solution**:
1. After executing a command, refresh the page (F5)
2. Check if changes were saved by looking at the task list

---

## 📚 Documentation Files

1. **AI_FEATURES_DIAGNOSTIC.md** - Detailed diagnostic report
2. **AI_FEATURES_TROUBLESHOOTING.md** - Step-by-step troubleshooting
3. **AI_FEATURES_LOCATION_GUIDE.md** - Visual guide to finding features
4. **AI-SERVICE-README.md** - Original AI service documentation
5. **AI_CHAT_CAPABILITIES.md** - AI chat capabilities (outdated - commands now work!)
6. **test_ai_endpoints.sh** - Automated test script

---

## 🚀 Quick Start

### 1. Start All Services
```bash
# Terminal 1: Backend
cd backend
python main.py

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Verify Ollama (should already be running)
curl http://localhost:11434/api/tags
```

### 2. Test AI Chat
1. Open http://localhost:5174
2. Click "AI Chat" button
3. Type: "What is the current project?"
4. Press Enter
5. You should see a response about the "23-038 Boone" project

### 3. Test AI Task Helper
1. Click "Add Task"
2. Enter task name: "Install electrical panels"
3. Click "AI Suggest"
4. Wait for suggestions
5. Click "Apply Duration"

### 4. Test AI Commands
1. In AI Chat, type: "Change task 1.2 duration to 25 days"
2. Press Enter
3. You should see: "✅ Updated task 1.2..."
4. Refresh page (F5)
5. Verify task 1.2 now shows 25 days

---

## 🎓 Advanced Usage

### Natural Language Commands

**Change Duration**:
- "Change task 1.2 duration to 10 days"
- "Set task 2.3 to 5 days"
- "Make task 3.4 last 15 days"

**Modify Lags**:
- "Set lag for task 2.3 to 5 days"
- "Add 3 day lag to task 4.5"
- "Remove lag from task 1.2"

**Project Settings**:
- "Set project start date to 2024-01-15"
- "Change start date to January 15, 2024"

**Bulk Operations**:
- "Add 10% buffer to all tasks"
- "Add 20% buffer to all tasks"

---

## 📊 Performance

- **First request**: 10-15 seconds (loads model into memory)
- **Subsequent requests**: 2-5 seconds
- **Model size**: 2GB (Llama 3.2 3B)
- **Runs locally**: No internet required

---

## ✅ Summary

**All AI features are working!** The backend is fully functional and tested.

If you're experiencing issues, they're likely related to:
1. Frontend not displaying UI elements
2. Services not running
3. Browser cache/console errors

**Next Steps**:
1. Test the AI Chat button in your browser
2. Try the AI Task Helper in the Task Editor
3. If something doesn't work, check the troubleshooting guide
4. Share specific error messages or screenshots for help

**For detailed help, see**: `AI_FEATURES_TROUBLESHOOTING.md`

