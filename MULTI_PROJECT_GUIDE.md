# 📁 Multi-Project Management Guide

## ✅ Status: FULLY IMPLEMENTED

Multi-project management is now fully functional in both the backend and frontend!

---

## 🎯 What You Can Do

### 1. **View All Projects**
- Click the **"Projects"** button in the top toolbar (📁 icon)
- See a list of all your projects
- View task count and start date for each project
- See which project is currently active

### 2. **Create New Projects**
- Click the **"Projects"** button
- Click **"New Project"** button
- Enter a project name
- Press Enter or click **"Create"**
- The new project becomes active immediately

### 3. **Switch Between Projects**
- Click the **"Projects"** button
- Find the project you want to open
- Click the **"Open"** button next to it
- The project loads and becomes active
- All tasks and data refresh automatically

### 4. **Delete Projects**
- Click the **"Projects"** button
- Find the project you want to delete
- Click the **"Delete"** button (🗑️ icon)
- Confirm the deletion
- **Note**: You cannot delete the currently active project

### 5. **Import Projects from XML**
- Click **"Upload XML"** button
- Select an MS Project XML file
- A new project is created from the XML
- The imported project becomes active

---

## 🖥️ User Interface

### Projects Button Location
```
┌─────────────────────────────────────────────────────────────┐
│  Project Configuration Tool                              │
├─────────────────────────────────────────────────────────────┤
│  [📁 Projects] [Upload XML] [New Task] ... [💬 AI Chat]    │
│       ↑                                                     │
│   Click here                                                │
└─────────────────────────────────────────────────────────────┘
```

### Project Manager Modal
```
┌─────────────────────────────────────────────────────────────┐
│  Project Manager                                      [X]   │
├─────────────────────────────────────────────────────────────┤
│  Your Projects                        [+ New Project]       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📁 23-038 Boone                    [Active]         │   │
│  │    282 tasks • 2024-02-08                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📁 Multi-Family                                     │   │
│  │    282 tasks • 2024-02-08          [Open] [🗑️]      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📁 Test Project                                     │   │
│  │    0 tasks • 2025-12-27            [Open] [🗑️]      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 How It Works

### Backend Architecture
- **SQLite Database**: Stores all projects and tasks
- **Project Isolation**: Each project has its own set of tasks
- **Active Project**: Only one project is active at a time
- **XML Templates**: Each project stores its original XML template

### Frontend Integration
- **React Query**: Automatically refreshes data when switching projects
- **Project Manager Component**: Modal dialog for project management
- **API Client**: Functions for all project operations

### Data Flow
```
User Action → Frontend API Call → Backend Endpoint → Database
                                                         ↓
User sees updated UI ← React Query Refresh ← Response ←┘
```

---

## 🧪 Testing Results

All multi-project features have been tested and verified:

✅ **GET /api/projects** - List all projects  
✅ **POST /api/projects/new** - Create new project  
✅ **POST /api/projects/{id}/switch** - Switch to project  
✅ **DELETE /api/projects/{id}** - Delete project  
✅ **Frontend UI** - Projects button and modal  
✅ **Project switching** - Data refreshes correctly  
✅ **Project creation** - New projects appear immediately  

---

## 📋 API Reference

### List All Projects
```bash
GET /api/projects

Response:
{
  "projects": [
    {
      "id": "uuid",
      "name": "Project Name",
      "task_count": 282,
      "start_date": "2024-02-08T08:00:00",
      "is_active": true
    }
  ]
}
```

### Create New Project
```bash
POST /api/projects/new?name=My%20Project

Response:
{
  "success": true,
  "message": "New project created",
  "project_id": "uuid",
  "project": { ... }
}
```

### Switch Project
```bash
POST /api/projects/{project_id}/switch

Response:
{
  "success": true,
  "message": "Switched to project",
  "project_id": "uuid",
  "project": { ... }
}
```

### Delete Project
```bash
DELETE /api/projects/{project_id}

Response:
{
  "success": true,
  "message": "Project deleted successfully"
}
```

---

## 🤖 AI Features with Multiple Projects

**All AI features work with the currently active project:**

- ✅ AI Chat answers questions about the active project
- ✅ AI commands modify tasks in the active project
- ✅ AI Task Helper estimates durations for the active project
- ✅ Critical path calculation uses the active project

**To use AI with a different project:**
1. Switch to that project using the Project Manager
2. Use AI features as normal
3. All AI operations apply to the newly active project

---

## 🎬 Step-by-Step Walkthrough

### Creating a New Project
1. Open http://localhost:5174
2. Click **"Projects"** button (top left)
3. Click **"+ New Project"**
4. Type: "My Construction Project"
5. Press Enter
6. ✅ New project is created and active
7. Start adding tasks!

### Switching Projects
1. Click **"Projects"** button
2. Find the project you want to open
3. Click **"Open"** button
4. ✅ Project loads with all its tasks
5. The Gantt chart updates automatically

### Importing a Project
1. Click **"Upload XML"** button
2. Select an MS Project XML file
3. ✅ New project is created from the XML
4. All tasks are imported
5. The project becomes active

### Deleting a Project
1. Click **"Projects"** button
2. Find a project that is **not active**
3. Click the **🗑️** button
4. Confirm deletion
5. ✅ Project is permanently deleted

---

## ⚠️ Important Notes

### Cannot Delete Active Project
- You must switch to another project first
- This prevents accidental data loss
- Error message: "Cannot delete the currently active project"

### Project Isolation
- Each project has its own tasks
- Tasks from one project don't appear in another
- AI features only see the active project's data

### Data Persistence
- All projects are saved to SQLite database
- Projects persist across server restarts
- XML templates are preserved for export

---

## 🆘 Troubleshooting

### "Projects button doesn't appear"
**Solution**: Make sure frontend is running and refresh the page (Ctrl+Shift+R)

### "Can't create new project"
**Solution**: Check browser console (F12) for errors. Backend must be running.

### "Project list is empty"
**Solution**: Import an XML file or create a new project manually

### "Can't switch projects"
**Solution**: Check backend logs. Database might be locked or corrupted.

### "Deleted project still appears"
**Solution**: Refresh the page or close/reopen the Project Manager modal

---

## 📊 Current Projects

You currently have **5 projects** in your database:

1. **Test Project** (0 tasks) - Active ✅
2. **23-038 Boone** (282 tasks)
3. **Multi-Family** (282 tasks)
4. **Multi-Family** (282 tasks) - Duplicate
5. **Multi-Family** (282 tasks) - Duplicate

**Recommendation**: Delete the duplicate "Multi-Family" projects to clean up your database.

---

## ✅ Summary

**Multi-project management is fully functional!**

You can now:
- ✅ Create unlimited projects
- ✅ Switch between projects instantly
- ✅ Delete projects you don't need
- ✅ Import projects from XML files
- ✅ Use AI features with any project
- ✅ Keep projects organized and isolated

**Next Steps**:
1. Open http://localhost:5174
2. Click the **"Projects"** button
3. Try creating, switching, and managing projects!

