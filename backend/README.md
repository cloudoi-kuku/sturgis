# MS Project Configuration API

FastAPI backend for MS Project XML manipulation and task management.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

## API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API Endpoints

### Project Management
- `POST /api/project/upload` - Upload MS Project XML file
- `GET /api/project/metadata` - Get project metadata
- `PUT /api/project/metadata` - Update project metadata

### Task Management
- `GET /api/tasks` - Get all tasks
- `POST /api/tasks` - Create a new task
- `PUT /api/tasks/{task_id}` - Update a task
- `DELETE /api/tasks/{task_id}` - Delete a task

### Validation & Export
- `POST /api/validate` - Validate project configuration
- `POST /api/export` - Export as MS Project XML

