# SQLite Database Migration

## Overview

The Project Configuration Tool now uses SQLite for persistent storage instead of JSON files. This provides:

- **Better multi-project support**: Each project is properly isolated in the database
- **Data integrity**: Foreign key constraints ensure data consistency
- **Performance**: Indexed queries for faster data retrieval
- **Concurrent access**: SQLite handles concurrent reads/writes safely
- **Atomic operations**: Database transactions ensure data consistency

## Database Schema

### Tables

#### `projects`
- `id` (TEXT, PRIMARY KEY): Unique project identifier
- `name` (TEXT): Project name
- `start_date` (TEXT): Project start date (ISO 8601)
- `status_date` (TEXT): Project status date (ISO 8601)
- `created_at` (TEXT): Creation timestamp
- `updated_at` (TEXT): Last update timestamp
- `is_active` (INTEGER): Whether this is the currently active project (0 or 1)
- `xml_template` (TEXT): Original MS Project XML template

#### `tasks`
- `id` (TEXT, PRIMARY KEY): Unique task identifier
- `project_id` (TEXT, FOREIGN KEY): Reference to parent project
- `uid` (TEXT): MS Project UID
- `name` (TEXT): Task name
- `outline_number` (TEXT): Task outline number (e.g., "1.2.3")
- `outline_level` (INTEGER): Hierarchy depth
- `duration` (TEXT): Duration in ISO 8601 format
- `value` (TEXT): Custom field value
- `milestone` (INTEGER): Whether task is a milestone (0 or 1)
- `summary` (INTEGER): Whether task is a summary task (0 or 1)
- `percent_complete` (INTEGER): Completion percentage (0-100)
- `start_date` (TEXT): Task start date
- `finish_date` (TEXT): Task finish date
- `actual_start` (TEXT): Actual start date
- `actual_finish` (TEXT): Actual finish date
- `actual_duration` (TEXT): Actual duration
- `create_date` (TEXT): Task creation date

#### `predecessors`
- `id` (INTEGER, PRIMARY KEY AUTOINCREMENT): Auto-generated ID
- `task_id` (TEXT, FOREIGN KEY): Reference to task
- `project_id` (TEXT, FOREIGN KEY): Reference to project
- `outline_number` (TEXT): Predecessor task outline number
- `type` (INTEGER): Dependency type (0=FF, 1=FS, 2=SF, 3=SS)
- `lag` (INTEGER): Lag time in the specified format
- `lag_format` (INTEGER): Lag format (7=days, 8=hours, etc.)

### Indexes

- `idx_tasks_project`: Index on `tasks(project_id)` for fast project queries
- `idx_tasks_outline`: Index on `tasks(project_id, outline_number)` for fast task lookups
- `idx_predecessors_task`: Index on `predecessors(task_id)` for fast predecessor queries
- `idx_predecessors_project`: Index on `predecessors(project_id)` for fast project-wide queries

## Migration from JSON

If you have existing JSON project data, run the migration script:

```bash
cd backend
python migrate_to_sqlite.py
```

This will:
1. Create the SQLite database at `backend/project_data/projects.db`
2. Migrate all projects from `backend/project_data/projects/*/project.json`
3. Migrate XML templates from `backend/project_data/projects/*/template.xml`
4. Set the most recently updated project as active

**Note**: The migration script generates new unique IDs for all tasks to avoid conflicts between projects.

## API Changes

The API endpoints remain the same, but now use SQLite instead of JSON files:

- `GET /api/projects` - List all projects
- `POST /api/projects/new` - Create a new project
- `POST /api/projects/{project_id}/switch` - Switch to a different project
- `DELETE /api/projects/{project_id}` - Delete a project
- `POST /api/upload` - Upload MS Project XML file
- `GET /api/tasks` - Get tasks for the active project
- `POST /api/tasks` - Create a new task
- `PUT /api/tasks/{task_id}` - Update a task
- `DELETE /api/tasks/{task_id}` - Delete a task

## Database Service

The `DatabaseService` class in `backend/database.py` provides all database operations:

```python
from database import DatabaseService

db = DatabaseService()

# Create a project
project_id = db.create_project("My Project", "2024-01-01", "2024-01-01")

# Get all projects
projects = db.list_projects()

# Switch to a project
db.switch_project(project_id)

# Get tasks for a project
tasks = db.get_tasks(project_id)

# Create a task
task_id = db.create_task(project_id, task_data)

# Update a task
db.update_task(task_id, updated_data)
```

## Backup and Recovery

### Backup

Simply copy the database file:

```bash
cp backend/project_data/projects.db backend/project_data/projects.db.backup
```

### Recovery

Replace the database file with a backup:

```bash
cp backend/project_data/projects.db.backup backend/project_data/projects.db
```

## Performance Considerations

- The database uses WAL (Write-Ahead Logging) mode for better concurrent access
- Indexes are created on frequently queried columns
- Foreign key constraints are enforced for data integrity
- Connection pooling is handled by SQLite automatically

## Future Enhancements

Potential improvements:
- Add user authentication and multi-user support
- Implement project sharing and collaboration
- Add audit logging for all changes
- Support for project templates
- Advanced search and filtering capabilities

