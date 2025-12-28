# 🤖 AI Chat Commands - Complete Guide

## ✨ **NEW FEATURE: AI Can Now Modify Your Project!**

The AI chat can now understand natural language commands and directly modify your project tasks, durations, lags, and project settings!

---

## 📋 **Available Commands**

### **1. Modify Task Duration**

Change the duration of a specific task.

**Syntax:**
- `"Change task 1.2 duration to 10 days"`
- `"Set task 2.3 to 15 days"`
- `"Update task 1.5 duration to 5 days"`
- `"Modify task 3.1 to 20 days"`

**Example:**
```
User: "Change task 1.2 duration to 10 days"
AI: "✅ Updated task 1.2 'Foundation Work' duration from 15.0 to 10 days

Changes made:
• Task 1.2 'Foundation Work': 15.0 → 10 days"
```

---

### **2. Modify Task Lag**

Set lag/delay for a task's predecessor.

**Syntax:**
- `"Set lag for task 2.3 to 5 days"`
- `"Change task 1.5 lag to 10 days"`
- `"Add 3 days lag to task 2.1"`
- `"Update task 3.2 lag to 7 days"`

**Example:**
```
User: "Set lag for task 2.3 to 5 days"
AI: "✅ Updated task 2.3 'Framing' lag from 0.0 to 5 days

Changes made:
• Task 2.3 lag: 0.0 → 5 days"
```

---

### **3. Remove Task Lag**

Remove all lags from a task.

**Syntax:**
- `"Remove lag from task 2.3"`
- `"Clear lag from task 1.5"`
- `"Delete lag from task 3.1"`

**Example:**
```
User: "Remove lag from task 2.3"
AI: "✅ Removed 1 lag(s) from task 2.3 'Framing'

Changes made:
• Task 2.3 lag: 5.0 → 0 days"
```

---

### **4. Set Project Start Date**

Change the project start date.

**Syntax:**
- `"Set project start date to 2024-01-15"`
- `"Change start date to 2024-02-01"`
- `"Project starts on 2024-03-01"`
- `"Update project start date to 2024-04-15"`

**Example:**
```
User: "Set project start date to 2024-01-15"
AI: "✅ Updated project start date from 2024-01-01 to 2024-01-15

Changes made:
• Project start date: 2024-01-01 → 2024-01-15"
```

---

### **5. Set Overall Project Duration**

Compress or extend the entire project by scaling all task durations proportionally.

**Syntax:**
- `"Set project duration to 180 days"`
- `"Change overall duration to 200 days"`
- `"Compress project to 150 days"`
- `"Project should be 250 days"`

**Example:**
```
User: "Set project duration to 180 days"
AI: "✅ Scaled project from 200 to 180 days (factor: 0.90). Modified 45 tasks.

Changes made:
• Task 1.1 'Site Preparation': 10.0 → 9 days
• Task 1.2 'Foundation Work': 15.0 → 14 days
• Task 2.1 'Framing': 20.0 → 18 days
• Task 2.2 'Roofing': 12.0 → 11 days
• Task 3.1 'Electrical': 8.0 → 7 days
• ... and 40 more changes"
```

---

### **6. Add Buffer to All Tasks**

Add a percentage buffer to all task durations.

**Syntax:**
- `"Add 10% buffer to all tasks"`
- `"Increase all tasks by 15%"`
- `"Add 20% buffer to all tasks"`

**Example:**
```
User: "Add 10% buffer to all tasks"
AI: "✅ Added 10% buffer to 45 tasks

Changes made:
• Task 1.1 'Site Preparation': 10.0 → 11 days
• Task 1.2 'Foundation Work': 15.0 → 17 days
• Task 2.1 'Framing': 20.0 → 22 days
• Task 2.2 'Roofing': 12.0 → 13 days
• Task 3.1 'Electrical': 8.0 → 9 days
• ... and 40 more changes"
```

---

## 🎨 **Visual Feedback**

When a command is executed:
- ✅ **Green badge** shows "✨ Modified X items"
- ⚡ **Lightning bolt avatar** instead of robot
- 🟢 **Green border** on the message bubble
- 📝 **Detailed change list** in the response

---

## 🔄 **Auto-Refresh**

After a command is executed:
- Changes are **automatically saved** to disk
- Project data is **updated in memory**
- A `projectUpdated` event is dispatched
- You can refresh the page to see changes in the Gantt chart

---

## 💡 **Tips**

1. **Task Identification**: Use the outline number (e.g., "1.2", "2.3") to identify tasks
2. **Date Format**: Use YYYY-MM-DD format for dates (e.g., "2024-01-15")
3. **Multiple Changes**: You can execute multiple commands in sequence
4. **Undo**: Currently no undo - changes are saved immediately
5. **Validation**: Commands are validated before execution

---

## ⚠️ **Important Notes**

- **Immediate Save**: All changes are saved to disk immediately
- **No Undo**: There's currently no undo functionality
- **Task Numbers**: Make sure to use the correct outline number
- **Predecessors**: Lag modifications only work on tasks with predecessors
- **Summary Tasks**: Duration changes don't affect summary tasks (they're calculated)
- **Milestones**: Duration changes don't affect milestones (they have 0 duration)

---

## 🚀 **Coming Soon**

Future enhancements:
- ✨ Add/remove task dependencies
- ✨ Create new tasks
- ✨ Delete tasks
- ✨ Bulk operations (e.g., "remove all lags")
- ✨ Undo/redo functionality
- ✨ Change approval flow
- ✨ Task filtering (e.g., "add buffer to all framing tasks")

---

## 📊 **Examples**

### **Example 1: Speed Up a Task**
```
User: "Change task 1.2 duration to 10 days"
AI: "✅ Updated task 1.2 'Foundation Work' duration from 15.0 to 10 days"
```

### **Example 2: Add Delay**
```
User: "Set lag for task 2.3 to 5 days"
AI: "✅ Updated task 2.3 'Framing' lag from 0.0 to 5 days"
```

### **Example 3: Compress Project**
```
User: "Compress project to 180 days"
AI: "✅ Scaled project from 200 to 180 days. Modified 45 tasks."
```

### **Example 4: Add Safety Buffer**
```
User: "Add 10% buffer to all tasks"
AI: "✅ Added 10% buffer to 45 tasks"
```

---

## 🎯 **Summary**

The AI chat is now a **powerful project modification tool**! You can:
- ✅ Modify task durations
- ✅ Set/remove task lags
- ✅ Change project start date
- ✅ Scale entire project duration
- ✅ Add buffers to all tasks

All through natural language commands! 🚀

