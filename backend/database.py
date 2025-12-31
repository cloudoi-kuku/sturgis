"""
SQLite database service for Sturgis Project
Handles multi-project persistence with proper isolation
"""
import sqlite3
import json
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
from contextlib import contextmanager


class DatabaseService:
    """SQLite database service for project management"""
    
    def __init__(self, db_path: str = "project_data/projects.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.init_database()
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row  # Enable column access by name
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def init_database(self):
        """Initialize database schema"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Projects table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    start_date TEXT NOT NULL,
                    status_date TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    is_active INTEGER DEFAULT 0,
                    xml_template TEXT
                )
            """)
            
            # Tasks table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    uid TEXT NOT NULL,
                    name TEXT NOT NULL,
                    outline_number TEXT NOT NULL,
                    outline_level INTEGER NOT NULL,
                    duration TEXT,
                    value TEXT,
                    milestone INTEGER DEFAULT 0,
                    summary INTEGER DEFAULT 0,
                    percent_complete INTEGER DEFAULT 0,
                    start_date TEXT,
                    finish_date TEXT,
                    actual_start TEXT,
                    actual_finish TEXT,
                    actual_duration TEXT,
                    create_date TEXT,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                )
            """)
            
            # Predecessors table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS predecessors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT NOT NULL,
                    project_id TEXT NOT NULL,
                    outline_number TEXT NOT NULL,
                    type INTEGER DEFAULT 1,
                    lag INTEGER DEFAULT 0,
                    lag_format INTEGER DEFAULT 7,
                    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                )
            """)
            
            # Project calendar table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS project_calendar (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT NOT NULL UNIQUE,
                    work_week TEXT DEFAULT '1,2,3,4,5',
                    hours_per_day INTEGER DEFAULT 8,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                )
            """)

            # Calendar exceptions table (holidays, working day overrides)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS calendar_exceptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT NOT NULL,
                    exception_date TEXT NOT NULL,
                    name TEXT NOT NULL,
                    is_working INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                    UNIQUE(project_id, exception_date)
                )
            """)

            # Task baselines table (MS Project supports up to 11 baselines: 0-10)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS task_baselines (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT NOT NULL,
                    project_id TEXT NOT NULL,
                    number INTEGER NOT NULL,
                    start TEXT,
                    finish TEXT,
                    duration TEXT,
                    duration_format INTEGER DEFAULT 7,
                    work TEXT,
                    cost REAL,
                    bcws REAL,
                    bcwp REAL,
                    fixed_cost REAL,
                    estimated_duration INTEGER DEFAULT 0,
                    interim INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                    UNIQUE(task_id, number)
                )
            """)

            # Users table for authentication
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    company TEXT,
                    password_hash TEXT NOT NULL,
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

            # Create indexes for better performance
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tasks_outline ON tasks(project_id, outline_number)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_predecessors_task ON predecessors(task_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_predecessors_project ON predecessors(project_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_project ON calendar_exceptions(project_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_task_baselines_task ON task_baselines(task_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_task_baselines_project ON task_baselines(project_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")

            conn.commit()
    
    def create_project(self, name: str, start_date: str, status_date: str, xml_template: Optional[str] = None) -> str:
        """Create a new project and return its ID"""
        project_id = str(uuid.uuid4())
        now = datetime.now().isoformat()
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Deactivate all other projects
            cursor.execute("UPDATE projects SET is_active = 0")
            
            # Insert new project
            cursor.execute("""
                INSERT INTO projects (id, name, start_date, status_date, created_at, updated_at, is_active, xml_template)
                VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            """, (project_id, name, start_date, status_date, now, now, xml_template))
            
        return project_id
    
    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get a project by ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
            row = cursor.fetchone()
            
            if row:
                return dict(row)
        return None
    
    def get_active_project(self) -> Optional[Dict[str, Any]]:
        """Get the currently active project"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM projects WHERE is_active = 1 LIMIT 1")
            row = cursor.fetchone()

            if row:
                return dict(row)
        return None

    def list_projects(self) -> List[Dict[str, Any]]:
        """List all projects"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT p.*, COUNT(t.id) as task_count
                FROM projects p
                LEFT JOIN tasks t ON p.id = t.project_id
                GROUP BY p.id
                ORDER BY p.updated_at DESC
            """)
            return [dict(row) for row in cursor.fetchall()]

    def get_historical_project_data(self, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Get historical project data for AI learning
        Returns recent projects with their tasks for pattern analysis
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Get recent projects (excluding current empty ones)
            cursor.execute("""
                SELECT p.id, p.name, p.start_date, p.status_date
                FROM projects p
                WHERE (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND summary = 0) > 5
                ORDER BY p.updated_at DESC
                LIMIT ?
            """, (limit,))

            projects = []
            for row in cursor.fetchall():
                project = dict(row)

                # Get tasks for this project
                cursor.execute("""
                    SELECT name, outline_number, outline_level, duration,
                           milestone, summary, percent_complete
                    FROM tasks
                    WHERE project_id = ?
                    ORDER BY outline_number
                """, (project['id'],))

                project['tasks'] = [dict(task) for task in cursor.fetchall()]

                # Get predecessor patterns
                cursor.execute("""
                    SELECT t.name, t.outline_number, p.outline_number as pred_outline,
                           p.type, p.lag, p.lag_format
                    FROM tasks t
                    JOIN predecessors p ON t.id = p.task_id
                    WHERE t.project_id = ?
                """, (project['id'],))

                project['dependencies'] = [dict(dep) for dep in cursor.fetchall()]

                projects.append(project)

            return projects

    def switch_project(self, project_id: str) -> bool:
        """Switch to a different project"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Check if project exists
            cursor.execute("SELECT id FROM projects WHERE id = ?", (project_id,))
            if not cursor.fetchone():
                return False

            # Deactivate all projects
            cursor.execute("UPDATE projects SET is_active = 0")

            # Activate the selected project
            cursor.execute("UPDATE projects SET is_active = 1, updated_at = ? WHERE id = ?",
                         (datetime.now().isoformat(), project_id))

            return True

    def update_project_metadata(self, project_id: str, name: str, start_date: str, status_date: str) -> bool:
        """Update project metadata"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE projects
                SET name = ?, start_date = ?, status_date = ?, updated_at = ?
                WHERE id = ?
            """, (name, start_date, status_date, datetime.now().isoformat(), project_id))

            return cursor.rowcount > 0

    def delete_project(self, project_id: str) -> bool:
        """Delete a project and all its tasks"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            return cursor.rowcount > 0

    def save_xml_template(self, project_id: str, xml_content: str) -> bool:
        """Save XML template for a project"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE projects
                SET xml_template = ?, updated_at = ?
                WHERE id = ?
            """, (xml_content, datetime.now().isoformat(), project_id))

            return cursor.rowcount > 0

    def get_xml_template(self, project_id: str) -> Optional[str]:
        """Get XML template for a project"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT xml_template FROM projects WHERE id = ?", (project_id,))
            row = cursor.fetchone()

            if row and row['xml_template']:
                return row['xml_template']
        return None

    def create_task(self, project_id: str, task_data: Dict[str, Any]) -> str:
        """Create a new task"""
        task_id = task_data.get('id', str(uuid.uuid4()))

        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO tasks (
                    id, project_id, uid, name, outline_number, outline_level,
                    duration, value, milestone, summary, percent_complete,
                    start_date, finish_date, actual_start, actual_finish, actual_duration, create_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                task_id, project_id, task_data.get('uid', task_id),
                task_data['name'], task_data['outline_number'], task_data.get('outline_level', 1),
                task_data.get('duration'), task_data.get('value', ''),
                1 if task_data.get('milestone', False) else 0,
                1 if task_data.get('summary', False) else 0,
                task_data.get('percent_complete', 0),
                task_data.get('start_date'), task_data.get('finish_date'),
                task_data.get('actual_start'), task_data.get('actual_finish'),
                task_data.get('actual_duration'), task_data.get('create_date')
            ))

            # Insert predecessors
            for pred in task_data.get('predecessors', []):
                cursor.execute("""
                    INSERT INTO predecessors (task_id, project_id, outline_number, type, lag, lag_format)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    task_id, project_id, pred['outline_number'],
                    pred.get('type', 1), pred.get('lag', 0), pred.get('lag_format', 7)
                ))

            # Insert baselines
            now = datetime.now().isoformat()
            for baseline in task_data.get('baselines', []):
                cursor.execute("""
                    INSERT INTO task_baselines (
                        task_id, project_id, number, start, finish, duration, duration_format,
                        work, cost, bcws, bcwp, fixed_cost, estimated_duration, interim, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    task_id, project_id, baseline.get('number', 0),
                    baseline.get('start'), baseline.get('finish'),
                    baseline.get('duration'), baseline.get('duration_format', 7),
                    baseline.get('work'), baseline.get('cost'),
                    baseline.get('bcws'), baseline.get('bcwp'), baseline.get('fixed_cost'),
                    1 if baseline.get('estimated_duration') else 0,
                    1 if baseline.get('interim') else 0,
                    now
                ))

            # Update project timestamp
            cursor.execute("UPDATE projects SET updated_at = ? WHERE id = ?",
                         (datetime.now().isoformat(), project_id))

        return task_id

    def get_tasks(self, project_id: str) -> List[Dict[str, Any]]:
        """Get all tasks for a project"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Get all tasks
            cursor.execute("""
                SELECT * FROM tasks
                WHERE project_id = ?
                ORDER BY outline_number
            """, (project_id,))

            tasks = []
            for row in cursor.fetchall():
                task = dict(row)
                # Convert boolean fields
                task['milestone'] = bool(task['milestone'])
                task['summary'] = bool(task['summary'])

                # Get predecessors for this task
                cursor.execute("""
                    SELECT outline_number, type, lag, lag_format
                    FROM predecessors
                    WHERE task_id = ?
                """, (task['id'],))

                task['predecessors'] = [dict(pred) for pred in cursor.fetchall()]

                # Get baselines for this task
                cursor.execute("""
                    SELECT number, start, finish, duration, duration_format,
                           work, cost, bcws, bcwp, fixed_cost, estimated_duration, interim
                    FROM task_baselines
                    WHERE task_id = ?
                    ORDER BY number
                """, (task['id'],))

                task['baselines'] = []
                for baseline_row in cursor.fetchall():
                    baseline = dict(baseline_row)
                    baseline['estimated_duration'] = bool(baseline['estimated_duration'])
                    baseline['interim'] = bool(baseline['interim'])
                    task['baselines'].append(baseline)

                tasks.append(task)

            return tasks

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get a single task by ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
            row = cursor.fetchone()

            if row:
                task = dict(row)
                task['milestone'] = bool(task['milestone'])
                task['summary'] = bool(task['summary'])

                # Get predecessors
                cursor.execute("""
                    SELECT outline_number, type, lag, lag_format
                    FROM predecessors
                    WHERE task_id = ?
                """, (task_id,))

                task['predecessors'] = [dict(pred) for pred in cursor.fetchall()]

                # Get baselines
                cursor.execute("""
                    SELECT number, start, finish, duration, duration_format,
                           work, cost, bcws, bcwp, fixed_cost, estimated_duration, interim
                    FROM task_baselines
                    WHERE task_id = ?
                    ORDER BY number
                """, (task_id,))

                task['baselines'] = []
                for baseline_row in cursor.fetchall():
                    baseline = dict(baseline_row)
                    baseline['estimated_duration'] = bool(baseline['estimated_duration'])
                    baseline['interim'] = bool(baseline['interim'])
                    task['baselines'].append(baseline)

                return task

        return None

    def update_task(self, task_id: str, task_data: Dict[str, Any]) -> bool:
        """Update an existing task"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Get project_id for this task
            cursor.execute("SELECT project_id FROM tasks WHERE id = ?", (task_id,))
            row = cursor.fetchone()
            if not row:
                return False

            project_id = row['project_id']

            # Build update query dynamically based on provided fields
            update_fields = []
            values = []

            for field in ['name', 'outline_number', 'duration', 'value', 'percent_complete',
                         'start_date', 'finish_date', 'actual_start', 'actual_finish', 'actual_duration']:
                if field in task_data:
                    update_fields.append(f"{field} = ?")
                    values.append(task_data[field])

            for field in ['milestone', 'summary']:
                if field in task_data:
                    update_fields.append(f"{field} = ?")
                    values.append(1 if task_data[field] else 0)

            if update_fields:
                values.append(task_id)
                cursor.execute(f"""
                    UPDATE tasks
                    SET {', '.join(update_fields)}
                    WHERE id = ?
                """, values)

            # Update predecessors if provided
            if 'predecessors' in task_data:
                # Delete existing predecessors
                cursor.execute("DELETE FROM predecessors WHERE task_id = ?", (task_id,))

                # Insert new predecessors
                for pred in task_data['predecessors']:
                    cursor.execute("""
                        INSERT INTO predecessors (task_id, project_id, outline_number, type, lag, lag_format)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        task_id, project_id, pred['outline_number'],
                        pred.get('type', 1), pred.get('lag', 0), pred.get('lag_format', 7)
                    ))

            # Update project timestamp
            cursor.execute("UPDATE projects SET updated_at = ? WHERE id = ?",
                         (datetime.now().isoformat(), project_id))

            return True

    def delete_task(self, task_id: str) -> bool:
        """Delete a task"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Get project_id before deleting
            cursor.execute("SELECT project_id FROM tasks WHERE id = ?", (task_id,))
            row = cursor.fetchone()
            if not row:
                return False

            project_id = row['project_id']

            # Delete task (predecessors will be deleted by CASCADE)
            cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))

            # Update project timestamp
            cursor.execute("UPDATE projects SET updated_at = ? WHERE id = ?",
                         (datetime.now().isoformat(), project_id))

            return cursor.rowcount > 0

    def delete_all_tasks(self, project_id: str) -> int:
        """Delete all tasks for a project"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Delete all tasks (predecessors will be deleted by CASCADE)
            cursor.execute("DELETE FROM tasks WHERE project_id = ?", (project_id,))
            deleted_count = cursor.rowcount

            # Update project timestamp
            cursor.execute("UPDATE projects SET updated_at = ? WHERE id = ?",
                         (datetime.now().isoformat(), project_id))

            return deleted_count

    def bulk_create_tasks(self, project_id: str, tasks: List[Dict[str, Any]]) -> int:
        """Bulk create tasks for a project (used during XML import)"""
        count = 0
        with self.get_connection() as conn:
            cursor = conn.cursor()

            for task_data in tasks:
                task_id = task_data.get('id', str(uuid.uuid4()))

                cursor.execute("""
                    INSERT INTO tasks (
                        id, project_id, uid, name, outline_number, outline_level,
                        duration, value, milestone, summary, percent_complete,
                        start_date, finish_date, actual_start, actual_finish, actual_duration, create_date
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    task_id, project_id, task_data.get('uid', task_id),
                    task_data['name'], task_data['outline_number'], task_data.get('outline_level', 1),
                    task_data.get('duration'), task_data.get('value', ''),
                    1 if task_data.get('milestone', False) else 0,
                    1 if task_data.get('summary', False) else 0,
                    task_data.get('percent_complete', 0),
                    task_data.get('start_date'), task_data.get('finish_date'),
                    task_data.get('actual_start'), task_data.get('actual_finish'),
                    task_data.get('actual_duration'), task_data.get('create_date')
                ))

                # Insert predecessors
                for pred in task_data.get('predecessors', []):
                    cursor.execute("""
                        INSERT INTO predecessors (task_id, project_id, outline_number, type, lag, lag_format)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        task_id, project_id, pred['outline_number'],
                        pred.get('type', 1), pred.get('lag', 0), pred.get('lag_format', 7)
                    ))

                # Insert baselines
                now = datetime.now().isoformat()
                for baseline in task_data.get('baselines', []):
                    cursor.execute("""
                        INSERT INTO task_baselines (
                            task_id, project_id, number, start, finish, duration, duration_format,
                            work, cost, bcws, bcwp, fixed_cost, estimated_duration, interim, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        task_id, project_id, baseline.get('number', 0),
                        baseline.get('start'), baseline.get('finish'),
                        baseline.get('duration'), baseline.get('duration_format', 7),
                        baseline.get('work'), baseline.get('cost'),
                        baseline.get('bcws'), baseline.get('bcwp'), baseline.get('fixed_cost'),
                        1 if baseline.get('estimated_duration') else 0,
                        1 if baseline.get('interim') else 0,
                        now
                    ))

                count += 1

            # Update project timestamp
            cursor.execute("UPDATE projects SET updated_at = ? WHERE id = ?",
                         (datetime.now().isoformat(), project_id))

        return count

    # ============================================================================
    # CALENDAR MANAGEMENT
    # ============================================================================

    def get_project_calendar(self, project_id: str) -> Dict[str, Any]:
        """Get calendar configuration for a project, creating default if not exists"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Get calendar config
            cursor.execute("""
                SELECT work_week, hours_per_day
                FROM project_calendar
                WHERE project_id = ?
            """, (project_id,))
            row = cursor.fetchone()

            if row:
                work_week = [int(d) for d in row['work_week'].split(',')]
                hours_per_day = row['hours_per_day']
            else:
                # Return defaults (Mon-Fri, 8 hours)
                work_week = [1, 2, 3, 4, 5]
                hours_per_day = 8

            # Get exceptions
            cursor.execute("""
                SELECT id, exception_date, name, is_working
                FROM calendar_exceptions
                WHERE project_id = ?
                ORDER BY exception_date
            """, (project_id,))

            exceptions = []
            for exc_row in cursor.fetchall():
                exceptions.append({
                    'id': exc_row['id'],
                    'exception_date': exc_row['exception_date'],
                    'name': exc_row['name'],
                    'is_working': bool(exc_row['is_working'])
                })

            return {
                'work_week': work_week,
                'hours_per_day': hours_per_day,
                'exceptions': exceptions
            }

    def save_project_calendar(self, project_id: str, work_week: List[int], hours_per_day: int) -> bool:
        """Save or update calendar configuration for a project"""
        now = datetime.now().isoformat()
        work_week_str = ','.join(str(d) for d in work_week)

        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Check if calendar exists
            cursor.execute("SELECT id FROM project_calendar WHERE project_id = ?", (project_id,))
            exists = cursor.fetchone() is not None

            if exists:
                cursor.execute("""
                    UPDATE project_calendar
                    SET work_week = ?, hours_per_day = ?, updated_at = ?
                    WHERE project_id = ?
                """, (work_week_str, hours_per_day, now, project_id))
            else:
                cursor.execute("""
                    INSERT INTO project_calendar (project_id, work_week, hours_per_day, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (project_id, work_week_str, hours_per_day, now, now))

            # Update project timestamp
            cursor.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))

            return True

    def add_calendar_exception(self, project_id: str, exception_date: str, name: str, is_working: bool = False) -> int:
        """Add a calendar exception (holiday or working day override)"""
        now = datetime.now().isoformat()

        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                INSERT OR REPLACE INTO calendar_exceptions (project_id, exception_date, name, is_working, created_at)
                VALUES (?, ?, ?, ?, ?)
            """, (project_id, exception_date, name, 1 if is_working else 0, now))

            # Update project timestamp
            cursor.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (now, project_id))

            return cursor.lastrowid

    def remove_calendar_exception(self, project_id: str, exception_date: str) -> bool:
        """Remove a calendar exception by date"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                DELETE FROM calendar_exceptions
                WHERE project_id = ? AND exception_date = ?
            """, (project_id, exception_date))

            if cursor.rowcount > 0:
                # Update project timestamp
                cursor.execute("UPDATE projects SET updated_at = ? WHERE id = ?",
                             (datetime.now().isoformat(), project_id))
                return True

            return False

    def get_calendar_exceptions(self, project_id: str) -> List[Dict[str, Any]]:
        """Get all calendar exceptions for a project"""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT id, exception_date, name, is_working
                FROM calendar_exceptions
                WHERE project_id = ?
                ORDER BY exception_date
            """, (project_id,))

            return [{
                'id': row['id'],
                'exception_date': row['exception_date'],
                'name': row['name'],
                'is_working': bool(row['is_working'])
            } for row in cursor.fetchall()]

    # ============================================================================
    # BASELINE MANAGEMENT
    # ============================================================================

    def set_baseline(self, project_id: str, baseline_number: int, task_ids: Optional[List[str]] = None) -> int:
        """Set a baseline for tasks in a project.

        Args:
            project_id: The project ID
            baseline_number: Baseline number (0-10)
            task_ids: Optional list of task IDs. If None, all tasks are baselined.

        Returns:
            Number of tasks baselined
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            now = datetime.now().isoformat()

            # Get tasks to baseline
            if task_ids:
                placeholders = ','.join('?' * len(task_ids))
                cursor.execute(f"""
                    SELECT id, start_date, finish_date, duration
                    FROM tasks
                    WHERE project_id = ? AND id IN ({placeholders})
                """, [project_id] + task_ids)
            else:
                cursor.execute("""
                    SELECT id, start_date, finish_date, duration
                    FROM tasks
                    WHERE project_id = ?
                """, (project_id,))

            tasks = cursor.fetchall()
            count = 0

            for task in tasks:
                task_id = task['id']

                # Delete existing baseline for this task and number
                cursor.execute("""
                    DELETE FROM task_baselines
                    WHERE task_id = ? AND number = ?
                """, (task_id, baseline_number))

                # Insert new baseline
                cursor.execute("""
                    INSERT INTO task_baselines (
                        task_id, project_id, number, start, finish, duration,
                        duration_format, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 7, ?)
                """, (
                    task_id, project_id, baseline_number,
                    task['start_date'], task['finish_date'], task['duration'],
                    now
                ))
                count += 1

            # Update project timestamp
            cursor.execute("UPDATE projects SET updated_at = ? WHERE id = ?",
                         (now, project_id))

            return count

    def clear_baseline(self, project_id: str, baseline_number: int, task_ids: Optional[List[str]] = None) -> int:
        """Clear a baseline for tasks in a project.

        Args:
            project_id: The project ID
            baseline_number: Baseline number (0-10)
            task_ids: Optional list of task IDs. If None, all baselines are cleared.

        Returns:
            Number of baselines cleared
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            if task_ids:
                placeholders = ','.join('?' * len(task_ids))
                cursor.execute(f"""
                    DELETE FROM task_baselines
                    WHERE project_id = ? AND number = ? AND task_id IN ({placeholders})
                """, [project_id, baseline_number] + task_ids)
            else:
                cursor.execute("""
                    DELETE FROM task_baselines
                    WHERE project_id = ? AND number = ?
                """, (project_id, baseline_number))

            count = cursor.rowcount

            # Update project timestamp
            cursor.execute("UPDATE projects SET updated_at = ? WHERE id = ?",
                         (datetime.now().isoformat(), project_id))

            return count

    def get_project_baselines(self, project_id: str) -> List[Dict[str, Any]]:
        """Get summary of all baselines in a project.

        Returns:
            List of baseline info with number, task count, and first set date
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT number, COUNT(*) as task_count, MIN(created_at) as set_date
                FROM task_baselines
                WHERE project_id = ?
                GROUP BY number
                ORDER BY number
            """, (project_id,))

            return [{
                'number': row['number'],
                'task_count': row['task_count'],
                'set_date': row['set_date']
            } for row in cursor.fetchall()]

    # ==================== USER MANAGEMENT ====================

    def create_user(self, email: str, name: str, password_hash: str, company: Optional[str] = None) -> str:
        """Create a new user and return their ID"""
        user_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO users (id, email, name, company, password_hash, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?)
            """, (user_id, email.lower(), name, company, password_hash, now, now))

        return user_id

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get a user by email address"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ? AND is_active = 1", (email.lower(),))
            row = cursor.fetchone()

            if row:
                return dict(row)
        return None

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a user by ID"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ? AND is_active = 1", (user_id,))
            row = cursor.fetchone()

            if row:
                return dict(row)
        return None

    def email_exists(self, email: str) -> bool:
        """Check if an email is already registered"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM users WHERE email = ?", (email.lower(),))
            return cursor.fetchone() is not None
