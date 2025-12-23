# MS Project Configuration Tool - Web Edition

A modern web-based tool for configuring and managing Microsoft Project XML files with an interactive Gantt chart visualization.

## Features

- 🎯 **Interactive Gantt Chart** - Visual timeline with task dependencies
- ✅ **Real-time Validation** - Catch configuration errors before export
- 🔄 **Task Management** - Create, edit, and delete tasks with ease
- 📊 **Dependency Visualization** - See task relationships at a glance
- 🚀 **Modern Architecture** - React frontend + Python FastAPI backend
- 💾 **XML Import/Export** - Seamless MS Project integration

## Architecture

### Frontend (React + Vite + TypeScript)
- Interactive Gantt chart visualization
- Task editor with predecessor management
- Real-time validation feedback
- Modern, responsive UI

### Backend (Python + FastAPI)
- RESTful API for XML manipulation
- Comprehensive validation engine
- Task dependency management
- MS Project XML parsing and generation

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start the backend server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Usage

1. **Upload Project**: Click "Upload XML" and select your MS Project XML file
2. **View Tasks**: See all tasks in the interactive Gantt chart
3. **Edit Tasks**: Click on any task to edit its properties
4. **Add Tasks**: Click "New Task" to create additional tasks
5. **Manage Dependencies**: Add predecessors to define task relationships
6. **Validate**: Click "Validate" to check for configuration errors
7. **Export**: Click "Export XML" to download the modified project file

## Task Properties

- **Name**: Task description
- **Outline Number**: Hierarchical position (e.g., 1.2.3)
- **Duration**: ISO 8601 format (e.g., PT8H0M0S for 8 hours)
- **Milestone**: Mark as milestone (zero duration)
- **Custom Value**: Extended attribute value
- **Predecessors**: Task dependencies with type (FS, SS, FF, SF) and lag

## Dependency Types

1. **Finish-to-Start (FS)**: Task B starts when Task A finishes
2. **Start-to-Start (SS)**: Task B starts when Task A starts
3. **Finish-to-Finish (FF)**: Task B finishes when Task A finishes
4. **Start-to-Finish (SF)**: Task B finishes when Task A starts

## Validation

The tool validates:
- ✅ Required fields (name, outline number, dates)
- ✅ Outline number format and uniqueness
- ✅ Duration format (ISO 8601)
- ✅ Predecessor existence
- ✅ Circular dependency detection
- ✅ Milestone duration constraints

## API Documentation

Once the backend is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Project Structure

```
.
├── backend/
│   ├── main.py              # FastAPI application
│   ├── models.py            # Pydantic models
│   ├── xml_processor.py     # XML parsing and generation
│   ├── validator.py         # Validation logic
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts    # API client
│   │   ├── components/
│   │   │   ├── GanttChart.tsx
│   │   │   └── TaskEditor.tsx
│   │   ├── App.tsx          # Main application
│   │   └── App.css          # Styles
│   └── package.json         # Node dependencies
└── README.md
```

## Development

### Backend Development
```bash
cd backend
python main.py  # Auto-reloads on file changes
```

### Frontend Development
```bash
cd frontend
npm run dev  # Hot module replacement enabled
```

## Building for Production

### Frontend
```bash
cd frontend
npm run build
```

The production build will be in `frontend/dist/`

## Troubleshooting

### CORS Issues
- Ensure the backend is running on port 8000
- Check that `VITE_API_URL` in `frontend/.env` matches your backend URL

### Validation Errors
- Check the validation panel for specific error messages
- Ensure all outline numbers are unique
- Verify predecessor tasks exist

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

