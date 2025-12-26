# 📍 Where to Find the AI Features in the UI

## 🎯 Exact Location

The **AI Task Helper** appears in the **Task Editor Dialog** when you:
1. Click **"+ Create Task"** button (top right of header)
2. OR click on any task in the Gantt chart to edit it

---

## 📸 Visual Layout

```
┌──────────────────────────────────────────────────────────┐
│ Create Task                                         [X]  │ ← Dialog Header
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Task Name *                                              │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Design database schema                               │ │ ← 1. Enter task name
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │  ✨ 🤖 AI Suggest                                    │ │ ← 2. AI BUTTON HERE!
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ 📊 Duration Estimate              [85% confident]    │ │
│ │                                                      │ │
│ │ 2.5 days                                             │ │ ← 3. AI suggestions
│ │                                                      │ │    appear here
│ │ Database schema design typically requires 2-3 days   │ │
│ │ for planning, entity modeling, and review            │ │
│ │                                                      │ │
│ │ [✓ Apply Duration]                                   │ │ ← 4. Click to apply
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────┬──────────────────────────┐   │
│ │ Outline Number *        │ Duration (days)          │   │
│ │ ┌─────────────────────┐ │ ┌──────────────────────┐ │   │
│ │ │ 1.2.3               │ │ │ 2.5                  │ │   │ ← 5. Auto-filled!
│ │ └─────────────────────┘ │ └──────────────────────┘ │   │
│ └─────────────────────────┴──────────────────────────┘   │
│                                                          │
│ ... rest of form ...                                     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                    [Cancel] [Create Task]│
└──────────────────────────────────────────────────────────┘
```

---

## 🎨 What the AI Button Looks Like

**Before clicking:**
```
┌────────────────────────────────────┐
│  ✨ 🤖 AI Suggest                  │  ← Purple gradient button
└────────────────────────────────────┘
```

**While loading:**
```
┌────────────────────────────────────┐
│  ⟳ Analyzing...                    │  ← Spinning loader
└────────────────────────────────────┘
```

**After clicking (suggestions appear):**
```
┌────────────────────────────────────────────┐
│ 📊 Duration Estimate    [85% confident] ✓  │
│                                            │
│ 2.5 days                                   │
│                                            │
│ Database schema design typically requires  │
│ 2-3 days for planning, entity modeling,    │
│ and review                                 │
│                                            │
│ [✓ Apply Duration]                         │
└────────────────────────────────────────────┘
```

---

## 🔍 How to Access

### **Method 1: Create New Task**
1. Click **"+ Create Task"** button in the top-right header
2. Task editor dialog opens
3. Type a task name
4. AI button appears below task name field

### **Method 2: Edit Existing Task**
1. Click on any task bar in the Gantt chart
2. Task editor dialog opens
3. AI button appears below task name field
4. Modify task name if needed
5. Click AI button for new suggestions

---

## ⚠️ When AI Button Does NOT Appear

The AI button is **hidden** in these cases:

### **1. Milestone Tasks**
```
☑ Milestone (zero duration)  ← Checkbox is checked
```
**Why?** Milestones have zero duration, so AI estimation doesn't apply.

### **2. Summary Tasks**
```
⚠️ Summary Task: This task has child tasks.
Duration is automatically calculated from children.
```
**Why?** Summary task durations are auto-calculated from child tasks.

### **3. Empty Task Name**
If the task name field is empty, AI button is disabled (grayed out).

---

## 🎯 Step-by-Step Usage

### **Complete Flow:**

1. **Open Task Editor**
   - Click "+ Create Task" OR click existing task

2. **Enter Task Name**
   - Type: "Design database schema"
   - AI button becomes active

3. **Click AI Button**
   - Button shows: "✨ 🤖 AI Suggest"
   - Changes to: "⟳ Analyzing..." (1-2 seconds)

4. **View Suggestions**
   - Duration estimate appears
   - Confidence score shown
   - Reasoning displayed

5. **Apply Suggestion**
   - Click "✓ Apply Duration"
   - Duration field auto-fills with suggested value

6. **Save Task**
   - Click "Create Task" or "Update Task"
   - Task saved with AI-suggested duration

---

## 🎨 Color Coding

### **Confidence Badges:**

**High Confidence (80-100%):**
```
[85% confident] ← Green background
```

**Medium Confidence (60-79%):**
```
[65% confident] ← Yellow background
```

**Low Confidence (<60%):**
```
[45% confident] ← Red background
```

---

## 💡 Tips

### **Best Results:**
- ✅ Use descriptive task names: "Design user authentication flow"
- ✅ Include context: "Implement JWT authentication for API"
- ✅ Be specific: "Write unit tests for payment module"

### **Less Effective:**
- ❌ Vague names: "Work on stuff"
- ❌ Too short: "Auth"
- ❌ Unclear: "Task 1"

---

## 🖼️ Screenshots Guide

**Where to look in your browser:**

1. **Header** (top of page)
   ```
   [MS Project Config] [Settings] [+ Create Task] [Upload] [Export]
                                   ↑
                                   Click here
   ```

2. **Dialog appears** (center of screen)
   ```
   Modal overlay (dark background)
   White dialog box in center
   ```

3. **AI button location** (inside dialog)
   ```
   Below "Task Name" field
   Above "Outline Number" and "Duration" fields
   Purple gradient button with sparkles icon
   ```

---

## 🧪 Quick Test

**To verify AI is working:**

1. Open http://localhost:5173
2. Click "+ Create Task"
3. Type: "Design database schema"
4. Look for purple button with "✨ 🤖 AI Suggest"
5. Click it
6. Wait 1-2 seconds
7. See suggestion card appear
8. Click "✓ Apply Duration"
9. Check duration field = 2.5 (or similar)

**If you see all of this, AI is working! ✅**

---

## 🆘 Troubleshooting

### **"I don't see the AI button"**

**Check:**
1. Is task name filled in? (Button disabled if empty)
2. Is "Milestone" checkbox unchecked?
3. Is it a summary task? (Check for yellow warning banner)
4. Open browser console (F12) - any errors?

### **"Button is grayed out"**

**Reason:** Task name is empty
**Solution:** Type a task name first

### **"Button shows but nothing happens when clicked"**

**Check:**
1. Is Ollama running? (`ollama serve` in terminal)
2. Is backend running? (`python main.py` in backend folder)
3. Check browser console (F12) for errors
4. Test backend: `curl http://localhost:8000/api/ai/health`

---

## ✅ Success Indicators

**You'll know it's working when:**

1. ✅ Purple gradient button appears
2. ✅ Button changes to "Analyzing..." when clicked
3. ✅ Suggestion card appears after 1-2 seconds
4. ✅ Confidence badge shows percentage
5. ✅ "Apply Duration" button is clickable
6. ✅ Duration field updates when applied

---

## 🎉 That's It!

The AI helper is **fully integrated** into the existing task editor. No separate chat window needed - it's built right into the workflow!

