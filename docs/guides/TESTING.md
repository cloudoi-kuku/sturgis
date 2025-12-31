# Testing Guide - Sturgis Project

## Quick Start Testing

### 1. Start Both Servers

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```
Backend should be running at: http://localhost:8000

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend should be running at: http://localhost:5173

### 2. Access the Application

Open your browser to: http://localhost:5173

You should see the Sturgis Project interface with an "Upload XML" button.

## Testing Workflow

### Test 1: Upload XML File

1. Click the "Upload XML" button
2. Select the `Mulit Family - Schedule.xml` file (or any MS Project XML file)
3. **Expected Result:**
   - Project metadata appears at the top (project name, start date, status date)
   - Gantt chart displays with all tasks
   - Tasks are shown in both the task list (left) and timeline (right)

### Test 2: View Gantt Chart

1. After uploading, observe the Gantt chart
2. **Expected Result:**
   - Task list shows: Task Name, Duration, Outline Number
   - Timeline shows colored bars representing task durations
   - Summary tasks have a different appearance
   - Milestones appear as diamonds
   - Tasks are positioned based on their start dates

### Test 3: Edit Existing Task

1. Click on any task in the Gantt chart
2. Task editor modal should open
3. Modify the task name or duration
4. Click "Update Task"
5. **Expected Result:**
   - Modal closes
   - Task updates in the Gantt chart
   - Changes are reflected immediately

### Test 4: Create New Task

1. Click the "New Task" button in the header
2. Fill in the form:
   - Name: "Test Task"
   - Outline Number: "99" (or any unique number)
   - Duration: "PT16H0M0S" (2 days)
   - Leave other fields as default
3. Click "Create Task"
4. **Expected Result:**
   - New task appears in the Gantt chart
   - Task is added to the task list

### Test 5: Add Task Dependencies

1. Click on a task to edit it
2. Click "Add Predecessor"
3. Select a predecessor task from the dropdown
4. Choose dependency type (e.g., Finish-to-Start)
5. Set lag to 0
6. Click "Update Task"
7. **Expected Result:**
   - Task updates successfully
   - Dependency is saved (you can verify by editing the task again)

### Test 6: Validation

1. Click the "Validate" button in the header
2. **Expected Result:**
   - If no errors: Alert shows "✅ Project validation passed!"
   - If errors exist: Alert shows error count and validation panel appears
   - Validation panel lists all errors with details

### Test 7: Create Invalid Task (Test Validation)

1. Click "New Task"
2. Enter invalid data:
   - Name: "Invalid Task"
   - Outline Number: "1" (duplicate of existing task)
   - Duration: "invalid" (not ISO 8601 format)
3. Click "Create Task"
4. Click "Validate"
5. **Expected Result:**
   - Validation errors appear
   - Errors show: duplicate outline number, invalid duration format

### Test 8: Export XML

1. After making changes, click "Export XML"
2. **Expected Result:**
   - If validation passes: XML file downloads automatically
   - If validation fails: Confirmation dialog asks if you want to export anyway
   - Downloaded file should be named after the project (e.g., "Project Name.xml")

### Test 9: Import Exported XML into MS Project

1. Export the XML file
2. Open Microsoft Project
3. File → Open → Select the exported XML file
4. **Expected Result:**
   - Project opens without errors
   - All tasks are present
   - Task dependencies are correct
   - Durations and dates are accurate

## API Testing

### Test API Endpoints Directly

You can test the API using the Swagger UI at: http://localhost:8000/docs

**Key Endpoints to Test:**

1. **POST /api/project/upload** - Upload XML file
2. **GET /api/project/metadata** - Get project info
3. **GET /api/tasks** - List all tasks
4. **POST /api/tasks** - Create new task
5. **PUT /api/tasks/{task_id}** - Update task
6. **DELETE /api/tasks/{task_id}** - Delete task
7. **POST /api/validate** - Validate project
8. **POST /api/export** - Export XML

### Example cURL Commands

**Upload Project:**
```bash
curl -X POST "http://localhost:8000/api/project/upload" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@Mulit Family - Schedule.xml"
```

**Get Tasks:**
```bash
curl -X GET "http://localhost:8000/api/tasks" \
  -H "accept: application/json"
```

**Validate Project:**
```bash
curl -X POST "http://localhost:8000/api/validate" \
  -H "accept: application/json"
```

## Common Issues and Solutions

### Issue 1: Frontend Can't Connect to Backend
**Symptoms:** Network errors in browser console
**Solution:** 
- Ensure backend is running on port 8000
- Check `frontend/.env` has correct API URL
- Verify CORS is enabled in backend

### Issue 2: Tasks Not Displaying
**Symptoms:** Empty Gantt chart after upload
**Solution:**
- Check browser console for errors
- Verify XML file is valid MS Project format
- Check backend logs for parsing errors

### Issue 3: Validation Errors
**Symptoms:** Can't export due to validation failures
**Solution:**
- Review validation panel for specific errors
- Fix outline number duplicates
- Ensure duration format is correct (PT8H0M0S)
- Remove circular dependencies

### Issue 4: Export File Won't Open in MS Project
**Symptoms:** MS Project shows errors when opening exported file
**Solution:**
- Run validation before export
- Ensure all required fields are filled
- Check that namespace and schema are correct
- Verify task IDs and UIDs are unique

## Performance Testing

### Large Project Test
1. Upload a project with 100+ tasks
2. Verify Gantt chart renders smoothly
3. Test scrolling performance
4. Check task editing responsiveness

### Concurrent Operations Test
1. Create multiple tasks quickly
2. Edit several tasks in succession
3. Validate frequently
4. Verify no race conditions or data loss

## Browser Compatibility

Test in multiple browsers:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari

## Next Steps

After successful testing:
1. Document any bugs found
2. Create test cases for edge scenarios
3. Consider adding automated tests
4. Plan for production deployment

