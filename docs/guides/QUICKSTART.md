# Quick Start Guide - Project Configuration Tool

Get up and running in 5 minutes!

## Prerequisites

- Python 3.8 or higher
- Node.js 16 or higher
- A Microsoft Project XML file to test with

## Installation

### 1. Clone or Download the Project

```bash
cd /path/to/ms-project-tool
```

### 2. Set Up Backend (2 minutes)

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Set Up Frontend (2 minutes)

```bash
# Navigate to frontend directory (from project root)
cd frontend

# Install dependencies
npm install
```

## Running the Application

### Start Backend Server

```bash
# From backend directory with venv activated
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started server process
INFO:     Application startup complete.
```

✅ Backend is running at: **http://localhost:8000**

### Start Frontend Server (New Terminal)

```bash
# From frontend directory
cd frontend
npm run dev
```

You should see:
```
VITE v7.3.0  ready in 353 ms

➜  Local:   http://localhost:5173/
```

✅ Frontend is running at: **http://localhost:5173**

## First Steps

### 1. Open the Application

Open your browser and go to: **http://localhost:5173**

You should see the Project Configuration Tool interface.

### 2. Upload Your First Project

1. Click the **"Upload XML"** button in the top-right corner
2. Select your Microsoft Project XML file
3. The Gantt chart will appear showing all your tasks!

### 3. Explore the Interface

**Task List (Left Side):**
- Task names
- Durations
- Outline numbers

**Timeline (Right Side):**
- Visual bars showing task durations
- Diamonds for milestones
- Different colors for summary tasks

### 4. Edit a Task

1. Click on any task in the Gantt chart
2. The Task Editor modal will open
3. Modify any field (name, duration, etc.)
4. Click **"Update Task"**
5. See your changes reflected immediately!

### 5. Create a New Task

1. Click **"New Task"** in the header
2. Fill in the form:
   - **Name:** "My New Task"
   - **Outline Number:** "100" (must be unique)
   - **Duration:** "PT8H0M0S" (8 hours = 1 day)
3. Click **"Create Task"**
4. Your new task appears in the Gantt chart!

### 6. Add Task Dependencies

1. Click on a task to edit it
2. Click **"Add Predecessor"**
3. Select a predecessor task from the dropdown
4. Choose dependency type (Finish-to-Start is default)
5. Click **"Update Task"**

### 7. Validate Your Project

1. Click **"Validate"** in the header
2. If there are errors, they'll be shown in a yellow panel
3. Fix any errors and validate again

### 8. Export Your Project

1. Click **"Export XML"** in the header
2. The file will download automatically
3. Open it in Microsoft Project to verify!

## Common Tasks

### Change Project Metadata

1. Click the **Settings** icon (⚙️) next to the project name
2. Update project name, start date, or status date
3. Click **"Save"**

### Delete a Task

1. Edit the task
2. Look for a delete button (or use the API directly)
3. Confirm deletion

### View API Documentation

While the backend is running, visit:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## Troubleshooting

### Backend Won't Start

**Error:** `ModuleNotFoundError: No module named 'fastapi'`

**Solution:** Make sure you activated the virtual environment:
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend Won't Start

**Error:** `Cannot find module...`

**Solution:** Install dependencies:
```bash
cd frontend
npm install
```

### Can't Upload File

**Error:** Network error or CORS error

**Solution:** 
1. Make sure backend is running on port 8000
2. Check `frontend/.env` has: `VITE_API_URL=http://localhost:8000`
3. Restart both servers

### Tasks Not Showing

**Solution:**
1. Check browser console for errors (F12)
2. Verify the XML file is valid MS Project format
3. Check backend logs for parsing errors

### Validation Errors

**Common Issues:**
- Duplicate outline numbers → Make each unique
- Invalid duration format → Use `PT8H0M0S` format
- Missing required fields → Fill in name and outline number

## Next Steps

Now that you're up and running:

1. **Read the full documentation:**
   - [README.md](README.md) - Overview and features
   - [ARCHITECTURE.md](ARCHITECTURE.md) - Technical details
   - [TESTING.md](TESTING.md) - Comprehensive testing guide

2. **Explore the API:**
   - Visit http://localhost:8000/docs
   - Try different endpoints
   - Understand the data models

3. **Customize the application:**
   - Modify the Gantt chart appearance in `frontend/src/App.css`
   - Add new validation rules in `backend/validator.py`
   - Extend the API with new endpoints

4. **Deploy to production:**
   - See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment options

## Getting Help

- Check the documentation files in the project root
- Review the code comments
- Test with the Swagger UI at http://localhost:8000/docs
- Check browser console and backend logs for errors

## Stopping the Servers

**Backend:**
- Press `Ctrl+C` in the terminal running the backend

**Frontend:**
- Press `Ctrl+C` in the terminal running the frontend

## Summary

You now have a fully functional Project Configuration Tool running locally! 

**What you can do:**
- ✅ Upload MS Project XML files
- ✅ View tasks in an interactive Gantt chart
- ✅ Create, edit, and delete tasks
- ✅ Manage task dependencies
- ✅ Validate project configuration
- ✅ Export modified XML files

Enjoy using the tool! 🚀

