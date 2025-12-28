# Chat Project Context Fix

## The Problem

**User Question:**
> "If I create an empty project and open chat to add tasks, does it create its own project or does it use the window the chat was triggered from?"

**Previous Behavior (WRONG):**
The chat always used the **globally active project** in the backend, not the specific project window it was opened from.

### Example of the Problem:
1. You have **Project A** (empty) and **Project B** (with tasks) in your database
2. **Project B** is currently active (loaded in the UI)
3. You switch to **Project A** in the project manager
4. You open chat from **Project A** and say: "Create a commercial office building"
5. ❌ **BUG:** The chat would try to populate **Project B** (the globally active one) instead of **Project A**

## The Solution

The chat now **always works with the specific project it was opened from**, not the globally active project.

### How It Works Now:

1. **Frontend passes project_id:**
   - When you open chat, it sends the current project's ID
   - Every chat message includes `project_id` in the request

2. **Backend uses specific project:**
   - Backend receives `project_id` in the request
   - Loads that specific project's data
   - Executes commands on that project
   - Saves changes to that project

3. **Result:**
   - Chat always modifies the project it was opened from
   - No confusion between multiple projects
   - Predictable, intuitive behavior

## Changes Made

### Frontend Changes

#### File: `frontend/src/components/AIChat.tsx`

**Added `projectId` prop:**
```typescript
interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string | null;  // NEW: The specific project this chat is for
}
```

**Send project_id with every message:**
```typescript
const response = await fetch('http://localhost:8000/api/ai/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    message: input,
    project_id: projectId  // NEW: Send the specific project ID
  })
});
```

**Send project_id when generating:**
```typescript
const genResponse = await fetch('http://localhost:8000/api/ai/generate-project', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    description: input,
    project_type: 'commercial',
    project_id: projectId  // NEW: Populate this specific project
  })
});
```

#### File: `frontend/src/App.tsx`

**Pass project_id to chat:**
```typescript
<AIChat
  isOpen={isChatOpen}
  onClose={() => setIsChatOpen(false)}
  projectId={metadata?.project_id}  // NEW: Pass current project ID
/>
```

#### File: `frontend/src/api/client.ts`

**Added project_id to metadata:**
```typescript
export type ProjectMetadata = {
  project_id?: string;  // NEW
  name: string;
  start_date: string;
  status_date: string;
}
```

### Backend Changes

#### File: `backend/models.py`

**Added project_id to requests:**
```python
class ChatRequest(BaseModel):
    message: str
    project_id: Optional[str] = None  # NEW: Specific project this chat is for

class GenerateProjectRequest(BaseModel):
    description: str = Field(...)
    project_type: str = Field(default="commercial")
    project_id: Optional[str] = None  # NEW: If provided, populate this specific project
```

#### File: `backend/main.py`

**1. Return project_id in metadata:**
```python
@app.get("/api/project/metadata")
async def get_project_metadata():
    return {
        "project_id": current_project_id,  # NEW
        "name": current_project.get("name"),
        "start_date": current_project.get("start_date"),
        "status_date": current_project.get("status_date"),
        "task_count": len(current_project.get("tasks", []))
    }
```

**2. Use specific project in chat:**
```python
@app.post("/api/ai/chat")
async def chat_with_ai(request: ChatRequest):
    # NEW: Determine which project to use
    target_project = current_project
    target_project_id = current_project_id
    
    if request.project_id:
        # Use the specific project requested
        project_data = db.get_project(request.project_id)
        if project_data:
            tasks = db.get_tasks(request.project_id)
            target_project = {
                "name": project_data["name"],
                "start_date": project_data["start_date"],
                "status_date": project_data["status_date"],
                "tasks": tasks
            }
            target_project_id = request.project_id
    
    # Use target_project instead of current_project
    ...
```

**3. Populate specific project when generating:**
```python
@app.post("/api/ai/generate-project")
async def generate_project_from_description(request: GenerateProjectRequest):
    # NEW: If a specific project_id was provided, check if it's empty
    if request.project_id:
        project_data = db.get_project(request.project_id)
        if project_data:
            existing_tasks = db.get_tasks(request.project_id)
            non_summary_tasks = [t for t in existing_tasks if not t.get("summary")]
            if len(non_summary_tasks) == 0:
                # Empty project - populate it
                populate_existing = True
                project_id = request.project_id
    ...
```

## Testing

### Test Scenario 1: Empty Project Population

1. **Create empty project:**
   - Click "New Project"
   - Name it "Test Office"

2. **Open chat from that project:**
   - Click AI Chat button

3. **Describe project:**
   ```
   Create a 5000 sq ft commercial office building
   ```

4. **Verify:**
   - ✅ Tasks appear in "Test Office" project
   - ✅ Project name updates to match description
   - ✅ No new project created

### Test Scenario 2: Multiple Projects

1. **Have two projects:**
   - Project A: "Empty Project" (no tasks)
   - Project B: "Existing Project" (has tasks)

2. **Load Project A**

3. **Open chat and say:**
   ```
   Create a warehouse project
   ```

4. **Verify:**
   - ✅ Project A gets populated with tasks
   - ✅ Project B remains unchanged

### Test Scenario 3: Edit Specific Project

1. **Load a project with tasks**

2. **Open chat and say:**
   ```
   Set task 1.2 duration to 10 days
   ```

3. **Verify:**
   - ✅ Task 1.2 in the current project is updated
   - ✅ Other projects remain unchanged

## Benefits

✅ **Predictable:** Chat always works with the project you're viewing  
✅ **Safe:** No accidental modifications to other projects  
✅ **Intuitive:** Matches user expectations  
✅ **Multi-project ready:** Can have multiple projects and chat works correctly for each

## Summary

**Before:** Chat used global active project (confusing, unpredictable)  
**After:** Chat uses the specific project it was opened from (clear, predictable)

This fix ensures that when you open chat from a project window, all AI operations (generation, editing, questions) apply to **that specific project only**.

