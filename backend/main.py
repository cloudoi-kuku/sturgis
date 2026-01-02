from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import xml.etree.ElementTree as ET
from datetime import datetime
import os
import json
from pathlib import Path

from models import (
    ProjectConfig,
    Task,
    TaskCreate,
    TaskUpdate,
    Predecessor,
    ValidationResult,
    ProjectMetadata,
    DurationEstimateRequest,
    DependencyDetectionRequest,
    TaskCategorizationRequest,
    ChatRequest,
    GenerateProjectRequest,
    OptimizeDurationRequest,
    OptimizationResult,
    ApplyOptimizationRequest,
    ProjectCalendar,
    CalendarException,
    CalendarExceptionCreate,
    SetBaselineRequest,
    ClearBaselineRequest,
    BaselineInfo,
    ProjectBaselinesResponse,
    # AI Project Editor models
    AIEditCommandRequest,
    AIEditResult,
    AISuggestionRequest,
    AISuggestionsResult,
    AISuggestion,
    TemplateLearnRequest,
    LearnedTemplate,
    ApplySuggestionRequest,
)
from xml_processor import MSProjectXMLProcessor
from validator import ProjectValidator
from ai_service import ai_service
from ai_command_handler import ai_command_handler
from ai_project_editor import ai_project_editor, project_template_learner
from database import DatabaseService, DATA_DIR
from auth import router as auth_router, get_current_user, decode_token
from azure_storage import init_azure_storage, shutdown_azure_storage, get_azure_storage
from contextlib import asynccontextmanager
import atexit

# Initialize Azure Storage BEFORE creating the database service
# This ensures the database is restored from blob storage on startup
_azure_storage = init_azure_storage(os.path.join(DATA_DIR, "projects.db"))

# Register shutdown handler for final backup
atexit.register(shutdown_azure_storage)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events"""
    # Startup: Azure storage already initialized above
    # Load saved project on startup (must be done here, not with @app.on_event which is deprecated with lifespan)
    load_project_on_startup()
    print("Application startup complete")
    yield
    # Shutdown: Perform final backup
    print("Application shutting down...")
    shutdown_azure_storage()


def load_project_on_startup():
    """Load saved project on server startup - called from lifespan handler"""
    # load_project_from_db is defined later but this function is called at runtime
    load_project_from_db()


app = FastAPI(
    title="MS Project Configuration API",
    version="1.0.0",
    lifespan=lifespan
)

# Include authentication router
app.include_router(auth_router)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative dev port
        "http://localhost",       # Docker frontend
        "http://localhost:80",    # Docker frontend with port
        "http://frontend",        # Docker service name
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage configuration
STORAGE_DIR = Path("project_data")
STORAGE_DIR.mkdir(exist_ok=True)


# Health check endpoint
@app.get("/api/health")
async def health_check():
    """Health check endpoint for container orchestration"""
    return {"status": "healthy", "service": "sturgis-project"}


# Azure Storage status and backup endpoints
@app.get("/api/storage/status")
async def get_storage_status():
    """Get Azure Storage service status"""
    storage = get_azure_storage()
    return storage.get_status()


@app.post("/api/storage/backup")
async def trigger_backup():
    """Manually trigger a backup to Azure Blob Storage"""
    storage = get_azure_storage()
    if not storage.enabled:
        raise HTTPException(
            status_code=400,
            detail="Azure Storage is not enabled. Set AZURE_STORAGE_CONNECTION_STRING environment variable."
        )

    success = storage.backup_to_azure(force=True)
    if success:
        return {"success": True, "message": "Database backed up to Azure Blob Storage"}
    else:
        raise HTTPException(status_code=500, detail="Backup failed")


@app.post("/api/storage/restore")
async def trigger_restore():
    """Manually trigger a restore from Azure Blob Storage"""
    storage = get_azure_storage()
    if not storage.enabled:
        raise HTTPException(
            status_code=400,
            detail="Azure Storage is not enabled. Set AZURE_STORAGE_CONNECTION_STRING environment variable."
        )

    success = storage.restore_from_azure()
    if success:
        return {"success": True, "message": "Database restored from Azure Blob Storage. Restart the application to reload data."}
    else:
        raise HTTPException(status_code=404, detail="No backup found in Azure Blob Storage")


# Initialize database service
db = DatabaseService()

# In-memory cache for the current project state (for backward compatibility)
current_project: Optional[Dict[str, Any]] = None
current_project_id: Optional[str] = None
xml_processor = MSProjectXMLProcessor()
validator = ProjectValidator()


from fastapi import Request

async def get_optional_user(request: Request) -> Optional[dict]:
    """Optional user dependency - returns user if authenticated, None otherwise.

    This allows endpoints to work both with and without authentication,
    enabling backward compatibility while supporting user-based filtering.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    payload = decode_token(token)
    if payload is None:
        return None

    user_id = payload.get("sub")
    if user_id is None:
        return None

    user = db.get_user_by_id(user_id)
    if user:
        user.pop("password_hash", None)
    return user


def save_project_to_db():
    """Save current project state to database"""
    global current_project_id
    if current_project and current_project_id:
        try:
            # Update project metadata
            db.update_project_metadata(
                current_project_id,
                current_project.get('name', 'Unnamed Project'),
                current_project.get('start_date', '2024-01-01'),
                current_project.get('status_date', '2024-01-01')
            )

            # Save XML template if available
            if xml_processor.xml_root is not None:
                xml_str = ET.tostring(xml_processor.xml_root, encoding='unicode')
                db.save_xml_template(current_project_id, xml_str)

            print(f"Saved project to database: {current_project.get('name', 'Unknown')} (ID: {current_project_id})")
        except Exception as e:
            print(f"Error saving project to database: {e}")


def load_project_from_db(project_id: Optional[str] = None):
    """Load project from database"""
    global current_project, current_project_id

    # If no project_id specified, load the active project
    if project_id is None:
        project_data = db.get_active_project()
        if project_data:
            project_id = project_data['id']

    if project_id:
        try:
            # Load project metadata
            project_data = db.get_project(project_id)
            if not project_data:
                return False

            # Load tasks
            tasks = db.get_tasks(project_id)

            # Build current_project dict
            current_project = {
                "name": project_data['name'],
                "start_date": project_data['start_date'],
                "status_date": project_data['status_date'],
                "tasks": tasks
            }
            current_project_id = project_id

            # Calculate summary tasks after loading
            current_project["tasks"] = xml_processor._calculate_summary_tasks(current_project["tasks"])

            # Load XML template if available
            xml_content = db.get_xml_template(project_id)
            if xml_content:
                xml_processor.xml_root = ET.fromstring(xml_content)
            else:
                xml_processor.xml_root = None

            # Switch to this project
            db.switch_project(project_id)

            print(f"Loaded project from database: {current_project.get('name', 'Unknown')} (ID: {project_id})")
            return True
        except Exception as e:
            print(f"Error loading project from database: {e}")

    return False


# NOTE: Project loading moved to lifespan handler (load_project_on_startup)
# @app.on_event is deprecated when using lifespan


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for Docker and monitoring"""
    return {
        "status": "healthy",
        "service": "MS Project Configuration API",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/")
async def root():
    """Root endpoint - serve frontend in production, API info in development"""
    # In production, serve the frontend
    static_index = Path("static/index.html")
    if static_index.exists():
        from fastapi.responses import FileResponse
        return FileResponse(static_index)
    # In development, return API info
    return {"status": "ok", "message": "MS Project Configuration API"}


@app.get("/api/projects")
async def get_all_projects(current_user: Optional[dict] = Depends(get_optional_user)):
    """Get list of all saved projects for the current user.

    If authenticated, returns:
    - Projects owned by the user
    - Shared projects
    - Projects with no owner (legacy)

    If not authenticated, returns all projects (backward compatibility).
    """
    user_id = current_user.get("id") if current_user else None
    projects = db.list_projects(user_id=user_id)

    # Format for frontend compatibility
    formatted_projects = []
    for p in projects:
        project_user_id = p.get('user_id')
        # Determine ownership:
        # - None (not logged in): is_owned = None
        # - Project has no owner (legacy): is_owned = True (treat as owned/editable)
        # - Project owned by current user: is_owned = True
        # - Project owned by someone else: is_owned = False
        if user_id is None:
            is_owned = None
        elif project_user_id is None:
            is_owned = True  # Legacy project, treat as owned
        else:
            is_owned = project_user_id == user_id

        formatted_projects.append({
            "id": p['id'],
            "name": p['name'],
            "task_count": p['task_count'],
            "start_date": p['start_date'],
            "is_active": bool(p['is_active']),
            "is_shared": bool(p.get('is_shared', 0)),
            "is_owned": is_owned
        })
    return {"projects": formatted_projects}


@app.post("/api/projects/new")
async def create_new_project(
    name: str = "New Project",
    is_shared: bool = False,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Create a new empty project.

    If authenticated, the project is associated with the current user.
    """
    global current_project, current_project_id

    user_id = current_user.get("id") if current_user else None

    # Create project in database
    project_id = db.create_project(
        name=name,
        start_date=datetime.now().strftime("%Y-%m-%d"),
        status_date=datetime.now().strftime("%Y-%m-%d"),
        user_id=user_id,
        is_shared=is_shared
    )

    # Create minimal project structure in memory
    current_project = {
        "name": name,
        "start_date": datetime.now().strftime("%Y-%m-%d"),
        "status_date": datetime.now().strftime("%Y-%m-%d"),
        "tasks": []
    }
    current_project_id = project_id

    # Clear XML template for new project
    xml_processor.xml_root = None

    return {
        "success": True,
        "message": "New project created",
        "project_id": project_id,
        "project": current_project
    }


@app.post("/api/projects/{project_id}/switch")
async def switch_project(
    project_id: str,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Switch to a different project.

    If authenticated, verifies the user has access to the project.
    """
    global current_project, current_project_id

    user_id = current_user.get("id") if current_user else None

    # Verify access and switch
    if not db.switch_project(project_id, user_id=user_id):
        raise HTTPException(status_code=404, detail="Project not found or access denied")

    if load_project_from_db(project_id):
        return {
            "success": True,
            "message": "Switched to project",
            "project_id": project_id,
            "project": current_project
        }
    else:
        raise HTTPException(status_code=404, detail="Project not found")


@app.put("/api/projects/{project_id}/share")
async def update_project_sharing(
    project_id: str,
    is_shared: bool = True,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Update project sharing status.

    Only the project owner can change sharing status.
    """
    user_id = current_user.get("id") if current_user else None

    if db.update_project_sharing(project_id, is_shared, user_id=user_id):
        return {
            "success": True,
            "message": f"Project {'shared' if is_shared else 'unshared'} successfully",
            "is_shared": is_shared
        }
    else:
        raise HTTPException(status_code=403, detail="Access denied or project not found")


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a project"""
    global current_project, current_project_id

    # Don't allow deleting the currently active project
    if project_id == current_project_id:
        raise HTTPException(status_code=400, detail="Cannot delete the currently active project. Switch to another project first.")

    if db.delete_project(project_id):
        return {
            "success": True,
            "message": "Project deleted successfully"
        }
    else:
        raise HTTPException(status_code=404, detail="Project not found")


@app.post("/api/project/upload")
async def upload_project(
    file: UploadFile = File(...),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Upload and parse an MS Project XML file - creates a new project.

    If authenticated, the project is associated with the current user.
    """
    global current_project, current_project_id

    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="File must be an XML file")

    user_id = current_user.get("id") if current_user else None

    try:
        print(f"=== Starting XML upload: {file.filename} ===")
        content = await file.read()
        print(f"File size: {len(content)} bytes")

        xml_content = content.decode('utf-8')
        print("File decoded successfully")

        # Parse the XML and extract project data
        print("Parsing XML...")
        project_data = xml_processor.parse_xml(xml_content)
        print(f"Parsed project: {project_data.get('name')}")
        print(f"Found {len(project_data.get('tasks', []))} tasks")

        # Create project in database
        print("Creating project in database...")
        project_id = db.create_project(
            name=project_data.get('name', 'Imported Project'),
            start_date=project_data.get('start_date', datetime.now().strftime("%Y-%m-%d")),
            status_date=project_data.get('status_date', datetime.now().strftime("%Y-%m-%d")),
            xml_template=xml_content,
            user_id=user_id
        )
        print(f"Project created with ID: {project_id}")

        # Generate new UUIDs for tasks (XML IDs are not globally unique)
        tasks = project_data.get('tasks', [])
        if tasks:
            print(f"Generating UUIDs for {len(tasks)} tasks...")
            import uuid
            for task in tasks:
                # Generate new UUID for database (preserve original ID in a separate field if needed)
                task["id"] = str(uuid.uuid4())
                # Keep UID from XML or generate new one
                if not task.get("uid"):
                    task["uid"] = task["id"]

            print(f"Inserting {len(tasks)} tasks...")
            db.bulk_create_tasks(project_id, tasks)
            print("Tasks inserted successfully")

        # Update in-memory state
        current_project = project_data
        current_project_id = project_id

        print("=== Upload completed successfully ===")
        return {
            "success": True,
            "message": "Project uploaded successfully",
            "project_id": project_id,
            "project": project_data
        }
    except Exception as e:
        print(f"=== UPLOAD ERROR ===")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"=== END ERROR ===")
        raise HTTPException(status_code=500, detail=f"Error parsing XML: {str(e)}")


@app.get("/api/project/metadata")
async def get_project_metadata():
    """Get current project metadata - always reads from database for consistency"""
    global current_project, current_project_id

    # Always fetch from database to ensure consistency across workers
    project_data = db.get_active_project()
    if not project_data:
        raise HTTPException(status_code=404, detail="No project loaded")

    # Sync in-memory state if out of sync
    if current_project_id != project_data['id']:
        load_project_from_db(project_data['id'])

    task_count = len(db.get_tasks(project_data['id']))

    return {
        "project_id": project_data['id'],
        "name": project_data['name'],
        "start_date": project_data['start_date'],
        "status_date": project_data['status_date'],
        "task_count": task_count
    }


@app.put("/api/project/metadata")
async def update_project_metadata(metadata: ProjectMetadata):
    """Update project metadata"""
    global current_project

    if not current_project or not current_project_id:
        raise HTTPException(status_code=404, detail="No project loaded")

    # Update in database
    db.update_project_metadata(
        current_project_id,
        metadata.name,
        metadata.start_date,
        metadata.status_date
    )

    # Update in-memory state
    current_project["name"] = metadata.name
    current_project["start_date"] = metadata.start_date
    current_project["status_date"] = metadata.status_date

    return {"success": True, "metadata": metadata}


@app.post("/api/project/save")
async def save_project():
    """
    Explicitly save the current project state to the database.
    This is the only way to persist changes - no auto-save.
    """
    global current_project, current_project_id

    if not current_project or not current_project_id:
        raise HTTPException(status_code=404, detail="No project loaded")

    try:
        # Update project metadata
        db.update_project_metadata(
            current_project_id,
            current_project.get('name', 'Unnamed Project'),
            current_project.get('start_date', '2024-01-01'),
            current_project.get('status_date', '2024-01-01')
        )

        # Save all tasks
        for task in current_project.get("tasks", []):
            db.update_task(task["id"], task)

        # Save XML template if available
        if xml_processor.xml_root is not None:
            xml_str = ET.tostring(xml_processor.xml_root, encoding='unicode')
            db.save_xml_template(current_project_id, xml_str)

        print(f"[SAVE] Project saved: {current_project.get('name', 'Unknown')} (ID: {current_project_id})")

        return {
            "success": True,
            "message": f"Project '{current_project.get('name', 'Unknown')}' saved successfully",
            "task_count": len(current_project.get("tasks", []))
        }
    except Exception as e:
        print(f"[SAVE ERROR] Failed to save project: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save project: {str(e)}")


@app.get("/api/tasks")
async def get_tasks():
    """Get all tasks in the current project - returns in-memory state for manual save mode"""
    global current_project, current_project_id

    # Check active project from database
    project_data = db.get_active_project()
    if not project_data:
        raise HTTPException(status_code=404, detail="No project loaded")

    # If no in-memory state or different project, load from database
    if not current_project or current_project_id != project_data['id']:
        load_project_from_db(project_data['id'])

    # MANUAL SAVE MODE: Return in-memory state (may have unsaved changes)
    if current_project and current_project.get("tasks"):
        tasks = current_project["tasks"]
        # Ensure summary tasks are calculated
        tasks = xml_processor._calculate_summary_tasks(tasks)
        return {"tasks": tasks}

    # Fallback: Load from database if no in-memory state
    tasks = db.get_tasks(project_data['id'])
    tasks = xml_processor._calculate_summary_tasks(tasks)

    if current_project:
        current_project["tasks"] = tasks

    return {"tasks": tasks}


@app.post("/api/tasks")
async def create_task(task: TaskCreate):
    """Create a new task"""
    global current_project

    if not current_project or not current_project_id:
        raise HTTPException(status_code=404, detail="No project loaded")

    # Validate the task
    task_dict = task.model_dump()
    validation = validator.validate_task(task_dict, current_project.get("tasks", []))
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["errors"])

    # Add the task to in-memory project
    # This also recalculates summary tasks for all affected tasks
    new_task = xml_processor.add_task(current_project, task_dict)

    # MANUAL SAVE MODE: Changes kept in memory only until user saves
    # db.create_task(current_project_id, new_task)
    # for task in current_project.get("tasks", []):
    #     if task["id"] != new_task["id"]:
    #         db.update_task(task["id"], task)
    # save_project_to_db()

    return {"success": True, "task": new_task}


@app.put("/api/tasks/{task_id}")
async def update_task(task_id: str, task: TaskUpdate):
    """Update an existing task"""
    global current_project

    if not current_project or not current_project_id:
        raise HTTPException(status_code=404, detail="No project loaded")

    # Find the existing task
    existing_task = None
    for t in current_project.get("tasks", []):
        if t["id"] == task_id or t["outline_number"] == task_id:
            existing_task = t
            break

    if not existing_task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Merge updates with existing task for validation
    updates = task.model_dump(exclude_unset=True)
    print(f"DEBUG: Updating task {task_id} with updates: {updates}")

    # Create a merged task dict for validation
    merged_task = {**existing_task, **updates}

    # Validate the updated task
    validation = validator.validate_task(merged_task, current_project.get("tasks", []))
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["errors"])

    # Update the task in memory
    # This also recalculates summary tasks for all affected tasks
    updated_task = xml_processor.update_task(current_project, task_id, updates)

    if not updated_task:
        raise HTTPException(status_code=404, detail="Task not found")

    # MANUAL SAVE MODE: Changes kept in memory only until user saves
    # for task in current_project.get("tasks", []):
    #     db.update_task(task["id"], task)
    # save_project_to_db()

    print(f"DEBUG: Updated task result: {updated_task}")
    return {"success": True, "task": updated_task}


@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    """Delete a task"""
    global current_project

    if not current_project or not current_project_id:
        raise HTTPException(status_code=404, detail="No project loaded")

    # Delete the task from memory
    # This also recalculates summary tasks for all affected tasks
    success = xml_processor.delete_task(current_project, task_id)

    if not success:
        raise HTTPException(status_code=404, detail="Task not found")

    # MANUAL SAVE MODE: Changes kept in memory only until user saves
    # db.delete_task(task_id)
    # for task in current_project.get("tasks", []):
    #     db.update_task(task["id"], task)
    # save_project_to_db()

    return {"success": True, "message": "Task deleted successfully"}


class MoveTaskRequest(BaseModel):
    """Request model for moving a task"""
    target_outline: str = Field(..., description="Outline number of the target task")
    position: str = Field(..., description="Position relative to target: 'under', 'before', or 'after'")


class MoveTaskResponse(BaseModel):
    """Response model for move task operation"""
    success: bool
    message: str
    changes: List[Dict[str, Any]] = []
    tasks_affected: int = 0


@app.post("/api/tasks/{task_id}/move", response_model=MoveTaskResponse)
async def move_task(task_id: str, request: MoveTaskRequest):
    """
    Move a task (and all its children) to a new position in the hierarchy.

    Position options:
    - "under": Move as a child of the target task
    - "before": Move before the target task (same level)
    - "after": Move after the target task (same level)

    This operation:
    - Updates all outline numbers for the moved task and its children
    - Updates predecessor references that point to moved tasks
    - Renumbers sibling tasks to maintain proper sequence
    - Automatically marks target as summary if moving "under"
    """
    global current_project, current_project_id

    # Validate position
    if request.position not in ["under", "before", "after"]:
        raise HTTPException(
            status_code=400,
            detail="Position must be 'under', 'before', or 'after'"
        )

    # Ensure we have fresh data from database
    project_data = db.get_active_project()
    if not project_data:
        raise HTTPException(status_code=404, detail="No project loaded")

    # Sync in-memory state if needed
    if current_project_id != project_data['id']:
        load_project_from_db(project_data['id'])

    if not current_project or not current_project_id:
        raise HTTPException(status_code=404, detail="No project loaded")

    # Find the source task by ID
    source_task = None
    for task in current_project.get("tasks", []):
        if task["id"] == task_id:
            source_task = task
            break

    if not source_task:
        raise HTTPException(status_code=404, detail=f"Task with ID {task_id} not found")

    source_outline = source_task["outline_number"]
    target_outline = request.target_outline

    # Find target task
    target_task = None
    for task in current_project.get("tasks", []):
        if task["outline_number"] == target_outline:
            target_task = task
            break

    if not target_task:
        raise HTTPException(status_code=404, detail=f"Target task with outline {target_outline} not found")

    # Pre-flight validation: Cannot move a task under its own children
    if request.position == "under":
        if target_outline.startswith(source_outline + ".") or target_outline == source_outline:
            raise HTTPException(
                status_code=400,
                detail="Cannot move a task under itself or its own children"
            )

    # Cannot move task to the same position
    if source_outline == target_outline:
        raise HTTPException(
            status_code=400,
            detail="Source and target are the same task"
        )

    # Execute the move using ai_project_editor
    result = ai_project_editor._move_task(
        current_project,
        source_outline,
        target_outline,
        request.position
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    # Get the updated project
    updated_project = result.get("project", current_project)

    # Update in-memory state
    current_project = updated_project

    # MANUAL SAVE MODE: Changes kept in memory only until user saves
    # existing_task_ids = {t["id"] for t in db.get_tasks(current_project_id)}
    # new_task_ids = {t["id"] for t in updated_project.get("tasks", [])}
    # for tid in existing_task_ids - new_task_ids:
    #     db.delete_task(tid)
    # for task in updated_project.get("tasks", []):
    #     if task["id"] in existing_task_ids:
    #         db.update_task(task["id"], task)
    #     else:
    #         db.create_task(current_project_id, task)
    # save_project_to_db()

    # Format changes for response
    changes = [
        {
            "type": c.get("type", "move"),
            "task_name": c.get("task_name"),
            "old_outline": c.get("old_outline"),
            "new_outline": c.get("new_outline"),
            "description": f"Moved from {c.get('old_outline')} to {c.get('new_outline')}"
        }
        for c in result.get("changes", [])
    ]

    return MoveTaskResponse(
        success=True,
        message=result["message"],
        changes=changes,
        tasks_affected=len(changes)
    )


@app.post("/api/validate")
async def validate_project():
    """Validate the entire project configuration"""
    if not current_project:
        raise HTTPException(status_code=404, detail="No project loaded")

    validation_result = validator.validate_project(current_project)

    return validation_result


@app.post("/api/export")
async def export_project():
    """Export the project as MS Project XML"""
    if not current_project:
        raise HTTPException(status_code=404, detail="No project loaded")

    # Check if XML template is available
    if xml_processor.xml_root is None:
        raise HTTPException(
            status_code=400,
            detail="No XML template available. Please upload an MS Project XML file first to establish the template."
        )

    # Validate before export
    validation_result = validator.validate_project(current_project)
    if not validation_result["valid"]:
        raise HTTPException(
            status_code=400,
            detail={"message": "Project has validation errors", "errors": validation_result["errors"]}
        )

    try:
        xml_content = xml_processor.generate_xml(current_project)

        # Use .mspdi extension for MS Project compatibility
        # This allows Windows to automatically associate the file with MS Project
        return Response(
            content=xml_content,
            media_type="application/xml",
            headers={
                "Content-Disposition": f"attachment; filename={current_project['name']}.mspdi"
            }
        )
    except Exception as e:
        print(f"Export error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating XML: {str(e)}")


# ============================================================================
# AI ENDPOINTS
# ============================================================================

class DurationEstimateRequest(BaseModel):
    task_name: str
    task_type: Optional[str] = ""

class DependencyDetectionRequest(BaseModel):
    tasks: List[Dict[str, Any]]

class TaskCategorizationRequest(BaseModel):
    task_name: str


@app.get("/api/ai/health")
async def ai_health_check():
    """Check if AI service is available"""
    is_healthy = await ai_service.health_check()
    model = ai_service.azure_deployment if ai_service.use_azure else ai_service.ollama_model
    provider = "Azure OpenAI" if ai_service.use_azure else "Ollama (Local)"
    return {
        "status": "healthy" if is_healthy else "unavailable",
        "model": model,
        "provider": provider
    }


@app.post("/api/ai/estimate-duration")
async def estimate_task_duration(request: DurationEstimateRequest):
    """
    AI-powered task duration estimation with project context
    Returns estimated days, confidence score, and reasoning
    """
    try:
        # Pass current project context to AI for better estimates
        result = await ai_service.estimate_duration(
            task_name=request.task_name,
            task_type=request.task_type,
            project_context=current_project  # ← Now context-aware!
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI estimation failed: {str(e)}")


@app.post("/api/ai/detect-dependencies")
async def detect_task_dependencies(request: DependencyDetectionRequest):
    """
    AI-powered dependency detection
    Analyzes task list and suggests logical dependencies
    """
    try:
        suggestions = await ai_service.detect_dependencies(request.tasks)
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dependency detection failed: {str(e)}")


@app.post("/api/ai/categorize-task")
async def categorize_task(request: TaskCategorizationRequest):
    """
    AI-powered task categorization with project context
    Returns category (site_work, foundation, structural, etc.) and confidence
    """
    try:
        result = await ai_service.categorize_task(
            request.task_name,
            project_context=current_project  # ← Now context-aware!
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Task categorization failed: {str(e)}")


# ============================================================================
# AI CHAT HELPER FUNCTIONS
# ============================================================================

async def _handle_suggestion_request(message: str, project: Dict, project_id: str) -> Dict:
    """Handle requests for project suggestions/analysis via chat"""
    tasks = project.get("tasks", [])
    suggestions = []

    message_lower = message.lower()

    # Determine what type of suggestions to provide
    check_sequence = any(w in message_lower for w in ['sequence', 'order', 'reorder'])
    check_deps = any(w in message_lower for w in ['dependency', 'dependencies', 'predecessor'])
    check_all = not check_sequence and not check_deps  # Default to all if not specific

    work_tasks = [t for t in tasks if not t.get("summary") and not t.get("milestone")]

    # Check for sequence issues
    if check_all or check_sequence:
        for i, task in enumerate(work_tasks):
            if i == 0:
                continue
            category = ai_project_editor._detect_construction_category(task["name"])
            order = ai_project_editor.construction_sequence.get(category, 99)

            prev_task = work_tasks[i-1]
            prev_category = ai_project_editor._detect_construction_category(prev_task["name"])
            prev_order = ai_project_editor.construction_sequence.get(prev_category, 99)

            # Skip general category
            if category == 'general' or prev_category == 'general':
                continue

            if order < prev_order - 1:
                suggestions.append({
                    "type": "sequence",
                    "issue": f"'{prev_task['name']}' ({prev_category}) appears before '{task['name']}' ({category})",
                    "command": f"move task {prev_task['outline_number']} after {task['outline_number']}",
                    "reason": f"{category} work typically comes before {prev_category}"
                })

    # Check for missing dependencies
    if check_all or check_deps:
        for task in work_tasks:
            has_predecessors = len(task.get("predecessors", [])) > 0
            category = ai_project_editor._detect_construction_category(task["name"])
            order = ai_project_editor.construction_sequence.get(category, 99)

            if not has_predecessors and order > 3 and category != 'general':
                suggestions.append({
                    "type": "dependency",
                    "issue": f"'{task['name']}' has no predecessors but is not an early-phase task",
                    "command": f"Consider adding a predecessor to task {task['outline_number']}",
                    "reason": f"{category} tasks typically depend on earlier work"
                })

    # Format response
    if not suggestions:
        response = "✅ **Project looks good!** No obvious sequence or dependency issues found.\n\n"
        response += "You can ask me to:\n"
        response += "• Move tasks: `move task 1.2 after 1.3`\n"
        response += "• Insert tasks: `insert task 'Site Prep' after 1.1`\n"
        response += "• Delete tasks: `delete task 1.4`\n"
        response += "• Merge tasks: `merge tasks 1.2 and 1.3`"
    else:
        response = f"📋 **Found {len(suggestions)} potential improvement(s):**\n\n"
        for i, s in enumerate(suggestions[:10], 1):  # Limit to 10
            response += f"**{i}. {s['type'].title()} Issue**\n"
            response += f"   {s['issue']}\n"
            response += f"   💡 Command: `{s['command']}`\n\n"

        if len(suggestions) > 10:
            response += f"_...and {len(suggestions) - 10} more issues_\n\n"

        response += "To apply a fix, just type the command (e.g., `move task 1.2 after 1.3`)"

    return {
        "response": response,
        "command_executed": False,
        "suggestions": suggestions[:10]
    }


async def _handle_editor_command(command: Dict, project: Dict, project_id: str, request_project_id: Optional[str]) -> Dict:
    """Handle project editor commands (move, insert, delete, etc.) via chat"""
    global current_project

    result = ai_project_editor.execute_command(command, project)

    if result["success"]:
        # Update project with changes
        updated_project = result["project"]

        # MANUAL SAVE MODE: Changes kept in memory only until user saves
        if request_project_id:
            # AI modifying a specific project - update in memory
            pass  # Changes stored in updated_project
        else:
            # Update current project in memory
            current_project = updated_project
        # Note: User must click Save to persist changes

        # Format response
        response = f"✅ {result['message']}\n\n"

        if result["changes"]:
            response += "**Changes made:**\n"
            for change in result["changes"][:5]:
                change_type = change.get("type", "update")
                if change_type == "move":
                    response += f"• Moved '{change.get('task_name', 'task')}': {change.get('old_outline')} → {change.get('new_outline')}\n"
                elif change_type == "insert":
                    response += f"• Inserted '{change.get('task_name')}' at {change.get('outline_number')}\n"
                elif change_type == "delete":
                    response += f"• Deleted '{change.get('task_name')}' ({change.get('outline_number')})\n"
                elif change_type == "merge":
                    response += f"• Merged into '{change.get('merged_name')}'\n"
                elif change_type == "split":
                    response += f"• Split '{change.get('original_task')}' into {change.get('num_parts')} parts\n"
                elif change_type == "reorder":
                    response += f"• Reordered '{change.get('task_name')}': {change.get('old_outline')} → {change.get('new_outline')}\n"
                else:
                    response += f"• {change}\n"

            if len(result["changes"]) > 5:
                response += f"• _...and {len(result['changes']) - 5} more changes_\n"

        return {
            "response": response.strip(),
            "command_executed": True,
            "changes": result["changes"]
        }
    else:
        return {
            "response": f"❌ {result['message']}\n\nTry commands like:\n• `move task 1.2 after 1.3`\n• `move task 1.2 under 2`\n• `delete task 1.4`",
            "command_executed": False,
            "error": result["message"]
        }


@app.post("/api/ai/chat")
async def chat_with_ai(request: ChatRequest):
    """
    Conversational AI chat for construction project assistance with command execution
    Can answer questions AND modify tasks/project based on natural language commands
    Returns AI response as text, plus any modifications made

    Supports:
    - Basic commands: set duration, set lag, set start date, etc.
    - Project editing: move task, insert task, delete task, merge tasks, etc.
    - Suggestions: "suggest improvements", "what's out of sequence?", etc.

    If project_id is provided, uses that specific project.
    Otherwise, uses the currently active project.
    """
    global current_project, current_project_id

    try:
        # Determine which project to use
        target_project = current_project
        target_project_id = current_project_id

        if request.project_id:
            # Use the specific project requested
            project_data = db.get_project(request.project_id)
            if project_data:
                # Load tasks for this project
                tasks = db.get_tasks(request.project_id)
                target_project = {
                    "name": project_data["name"],
                    "start_date": project_data["start_date"],
                    "status_date": project_data["status_date"],
                    "tasks": tasks
                }
                target_project_id = request.project_id

        message_lower = request.message.lower().strip()

        # Check for suggestion requests
        if target_project and any(phrase in message_lower for phrase in [
            'suggest', 'improvement', 'what should', 'out of sequence',
            'analyze', 'review', 'check for issues', 'find problems'
        ]):
            return await _handle_suggestion_request(request.message, target_project, target_project_id)

        # Check for project editor commands (move, insert, delete, merge, split, etc.)
        editor_command = ai_project_editor.parse_command(request.message)
        if editor_command and target_project:
            return await _handle_editor_command(editor_command, target_project, target_project_id, request.project_id)

        # Check for basic commands (duration, lag, start date, etc.)
        command = ai_command_handler.parse_command(request.message)

        if command and target_project:
            # Execute the command on the target project
            result = ai_command_handler.execute_command(command, target_project)

            if result["success"]:
                # MANUAL SAVE MODE: Changes kept in memory only until user saves
                # if request.project_id:
                #     for task in target_project.get("tasks", []):
                #         db.update_task(task["id"], task)
                # else:
                #     save_project_to_db()
                # Note: User must click Save to persist changes

                # Generate AI response confirming the change
                response = f"✅ {result['message']}\n\n"

                # Add details about changes
                if result["changes"]:
                    response += "Changes made:\n"
                    for change in result["changes"][:5]:  # Show first 5 changes
                        if change["type"] == "duration":
                            response += f"• Task {change['task']} '{change['task_name']}': {change['old_days']:.1f} → {change['new_days']} days\n"
                        elif change["type"] == "lag":
                            response += f"• Task {change['task']} lag: {change['old_days']:.1f} → {change['new_days']} days\n"
                        elif change["type"] == "constraint_type":
                            response += f"• Task {change['task']} constraint: {change['old_name']} → {change['new_name']}\n"
                        elif change["type"] == "constraint_date":
                            old_date = change['old_value'].split('T')[0] if change['old_value'] else 'None'
                            new_date = change['new_value'].split('T')[0] if change['new_value'] else 'None'
                            response += f"• Task {change['task']} constraint date: {old_date} → {new_date}\n"
                        elif change["type"] == "project_start_date":
                            response += f"• Project start date: {change['old_value']} → {change['new_value']}\n"

                    if len(result["changes"]) > 5:
                        response += f"• ... and {len(result['changes']) - 5} more changes\n"

                return {
                    "response": response.strip(),
                    "command_executed": True,
                    "changes": result["changes"]
                }
            else:
                # Command failed, let AI explain why
                response = await ai_service.chat(
                    user_message=f"I tried to execute: '{request.message}' but got error: {result['message']}. Please explain this to the user.",
                    project_context=current_project
                )
                return {
                    "response": response,
                    "command_executed": False,
                    "error": result["message"]
                }

        # No command detected, use normal AI chat with historical context
        historical_data = db.get_historical_project_data(limit=5)
        response = await ai_service.chat(
            user_message=request.message,
            project_context=target_project,  # Use target project, not current
            historical_data=historical_data
        )
        return {
            "response": response,
            "command_executed": False
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@app.post("/api/ai/chat/clear")
async def clear_chat_history():
    """Clear chat conversation history"""
    ai_service.clear_chat_history()
    return {"success": True, "message": "Chat history cleared"}


@app.post("/api/ai/generate-project")
async def generate_project_from_description(
    request: GenerateProjectRequest,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """
    Generate a complete construction project from a natural language description.
    Can either create a new project OR populate an existing empty project.

    If authenticated, the project is associated with the current user.

    Returns: {
        "success": bool,
        "project_id": str,
        "project_name": str,
        "task_count": int,
        "message": str
    }
    """
    global current_project, current_project_id

    user_id = current_user.get("id") if current_user else None

    try:
        # Get historical project data for AI learning
        historical_data = db.get_historical_project_data(limit=5)
        print(f"Using {len(historical_data)} historical projects as guidelines")

        # Generate project using AI with historical context
        result = await ai_service.generate_project(
            description=request.description,
            project_type=request.project_type,
            historical_data=historical_data
        )

        if not result.get("success", False):
            raise HTTPException(
                status_code=500,
                detail=f"AI project generation failed: {result.get('error', 'Unknown error')}"
            )

        project_name = result.get("project_name", "AI Generated Project")
        start_date = result.get("start_date", datetime.now().strftime("%Y-%m-%d"))
        tasks = result.get("tasks", [])

        # Check if we should populate existing empty project or create new one
        populate_existing = False

        # If a specific project_id was provided, check if it's empty
        if request.project_id:
            project_data = db.get_project(request.project_id)
            if project_data:
                existing_tasks = db.get_tasks(request.project_id)
                non_summary_tasks = [t for t in existing_tasks if not t.get("summary")]
                if len(non_summary_tasks) == 0:
                    # Empty project - populate it
                    populate_existing = True
                    project_id = request.project_id
                    print(f"Populating specific empty project: {project_data.get('name')} (ID: {project_id})")
        # Otherwise, check current project
        elif current_project and current_project_id:
            existing_tasks = current_project.get("tasks", [])
            non_summary_tasks = [t for t in existing_tasks if not t.get("summary")]
            if len(non_summary_tasks) == 0:
                # Empty project - populate it instead of creating new one
                populate_existing = True
                project_id = current_project_id
                print(f"Populating current empty project: {current_project.get('name')} (ID: {project_id})")

        if not populate_existing:
            # Create new project in database
            project_id = db.create_project(
                name=project_name,
                start_date=start_date,
                status_date=start_date,
                user_id=user_id
            )
            print(f"Created new project: {project_name} (ID: {project_id})")

        # Add project_id and generate UIDs for each task
        import uuid
        for task in tasks:
            task["id"] = str(uuid.uuid4())
            task["uid"] = task["id"]
            task["project_id"] = project_id

        # Insert generated tasks
        if tasks:
            if populate_existing:
                # Clear any existing tasks first (should be none, but just in case)
                db.delete_all_tasks(project_id)

            db.bulk_create_tasks(project_id, tasks)

        # Update project metadata if populating existing
        if populate_existing:
            db.update_project_metadata(project_id, project_name, start_date, start_date)

        # IMPORTANT: Switch to the new/populated project in database
        # This sets is_active=1 for this project and is_active=0 for others
        db.switch_project(project_id)

        # Get fresh tasks from database with all computed fields
        db_tasks = db.get_tasks(project_id)

        # Update in-memory state with database tasks
        current_project = {
            "name": project_name,
            "start_date": start_date,
            "status_date": start_date,
            "tasks": db_tasks
        }
        current_project_id = project_id

        # Clear XML template for AI-generated project
        xml_processor.xml_root = None

        print(f"Switched to project: {project_name} (ID: {project_id}) with {len(db_tasks)} tasks")

        action = "populated" if populate_existing else "created"
        return {
            "success": True,
            "project_id": project_id,
            "project_name": project_name,
            "task_count": len(tasks),
            "message": f"Successfully {action} project '{project_name}' with {len(tasks)} tasks"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Project generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate project: {str(e)}")


# ============================================================================
# PROJECT DURATION OPTIMIZATION ENDPOINTS (MS Project Compliant)
# ============================================================================

@app.post("/api/ai/optimize-duration", response_model=OptimizationResult)
async def optimize_project_duration(request: OptimizeDurationRequest):
    """
    Optimize project to meet target duration.
    Returns multiple strategies with cost/risk analysis.

    MS Project Compliant:
    - Respects critical path calculation
    - Modifies LinkLag (lag times) per MS Project schema
    - Modifies Duration in ISO 8601 format
    - Preserves dependency types (FF, FS, SF, SS)
    """
    global current_project

    if not current_project:
        raise HTTPException(status_code=404, detail="No project loaded")

    try:
        result = ai_service.optimize_project_duration(
            target_days=request.target_days,
            project_context=current_project
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


@app.get("/api/critical-path")
async def get_critical_path():
    """
    Calculate and return the critical path for the current project.

    Returns:
        - critical_tasks: List of tasks on the critical path
        - project_duration: Total project duration in days
        - task_floats: Dictionary of task_id -> total_float (slack time)
    """
    global current_project

    if not current_project:
        raise HTTPException(status_code=404, detail="No project loaded")

    tasks = current_project.get("tasks", [])

    if not tasks:
        return {
            "critical_tasks": [],
            "project_duration": 0,
            "task_floats": {},
            "critical_task_ids": []
        }

    try:
        # Use the AI service's critical path calculation
        result = ai_service._calculate_critical_path(tasks)

        # Extract just the IDs for easier frontend use
        critical_task_ids = [task["id"] for task in result["critical_tasks"]]

        return {
            "critical_tasks": result["critical_tasks"],
            "project_duration": result["project_duration"],
            "task_floats": result["task_floats"],
            "critical_task_ids": critical_task_ids
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Critical path calculation failed: {str(e)}")


@app.post("/api/ai/apply-optimization")
async def apply_optimization_strategy(request: ApplyOptimizationRequest):
    """
    Apply an optimization strategy to the project.
    Updates tasks and saves changes to disk.

    MS Project Compliant:
    - Updates LinkLag values in minutes (480 min = 1 day)
    - Updates Duration in ISO 8601 format (PT{hours}H0M0S)
    - Preserves all MS Project XML schema requirements
    """
    global current_project

    if not current_project:
        raise HTTPException(status_code=404, detail="No project loaded")

    try:
        tasks = current_project.get("tasks", [])
        changes_applied = 0

        # Apply each change based on type
        for change in request.changes:
            # Find the task
            task = next((t for t in tasks if t["id"] == change["task_id"]), None)
            if not task:
                continue

            if change["change_type"] == "lag_reduction":
                # Update lag in predecessor relationship
                for pred in task.get("predecessors", []):
                    if pred["outline_number"] == change.get("predecessor_outline"):
                        # Update lag in MS Project format (minutes)
                        new_lag_minutes = int(change["suggested_value"] * 480)
                        pred["lag"] = new_lag_minutes
                        changes_applied += 1
                        print(f"Updated lag for task {task['name']}: {change['current_value']:.1f}d → {change['suggested_value']:.1f}d")

            elif change["change_type"] == "duration_compression":
                # Update task duration in MS Project ISO 8601 format
                new_duration_hours = int(change["suggested_value"] * 8)
                task["duration"] = f"PT{new_duration_hours}H0M0S"
                changes_applied += 1
                print(f"Compressed task {task['name']}: {change['current_value']:.1f}d → {change['suggested_value']:.1f}d")

        # MANUAL SAVE MODE: Changes kept in memory only until user saves
        # for task in current_project.get("tasks", []):
        #     db.update_task(task['id'], task)
        # save_project_to_db()
        # Note: User must click Save to persist changes

        return {
            "success": True,
            "message": f"Applied {changes_applied} changes successfully. Remember to Save!",
            "changes_applied": changes_applied,
            "strategy_id": request.strategy_id
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply optimization: {str(e)}")


# ============================================================================
# CALENDAR MANAGEMENT ENDPOINTS
# ============================================================================

@app.get("/api/calendar")
async def get_calendar():
    """
    Get the calendar configuration for the current project.
    Returns work week settings, hours per day, and all exceptions (holidays).
    """
    global current_project_id

    if not current_project_id:
        raise HTTPException(status_code=404, detail="No project loaded")

    try:
        calendar = db.get_project_calendar(current_project_id)
        return calendar
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get calendar: {str(e)}")


@app.put("/api/calendar")
async def update_calendar(calendar: ProjectCalendar):
    """
    Update the calendar configuration for the current project.
    Updates work week and hours per day settings.
    """
    global current_project_id

    if not current_project_id:
        raise HTTPException(status_code=404, detail="No project loaded")

    try:
        # Save calendar settings
        db.save_project_calendar(
            current_project_id,
            calendar.work_week,
            calendar.hours_per_day
        )

        # Update exceptions if provided
        # First, get existing exceptions to compare
        existing = db.get_calendar_exceptions(current_project_id)
        existing_dates = {e['exception_date'] for e in existing}
        new_dates = {e.exception_date for e in calendar.exceptions}

        # Remove exceptions that are no longer in the list
        for exc in existing:
            if exc['exception_date'] not in new_dates:
                db.remove_calendar_exception(current_project_id, exc['exception_date'])

        # Add or update exceptions
        for exc in calendar.exceptions:
            db.add_calendar_exception(
                current_project_id,
                exc.exception_date,
                exc.name,
                exc.is_working
            )

        return {"success": True, "message": "Calendar updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update calendar: {str(e)}")


@app.post("/api/calendar/exceptions")
async def add_calendar_exception(exception: CalendarExceptionCreate):
    """
    Add a calendar exception (holiday or working day override).
    """
    global current_project_id

    if not current_project_id:
        raise HTTPException(status_code=404, detail="No project loaded")

    try:
        exception_id = db.add_calendar_exception(
            current_project_id,
            exception.exception_date,
            exception.name,
            exception.is_working
        )

        return {
            "success": True,
            "message": f"Exception added for {exception.exception_date}",
            "id": exception_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add exception: {str(e)}")


@app.delete("/api/calendar/exceptions/{exception_date}")
async def remove_calendar_exception(exception_date: str):
    """
    Remove a calendar exception by date.
    Date format: YYYY-MM-DD
    """
    global current_project_id

    if not current_project_id:
        raise HTTPException(status_code=404, detail="No project loaded")

    try:
        removed = db.remove_calendar_exception(current_project_id, exception_date)

        if removed:
            return {"success": True, "message": f"Exception removed for {exception_date}"}
        else:
            raise HTTPException(status_code=404, detail=f"No exception found for {exception_date}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove exception: {str(e)}")


# ============================================================================
# BASELINE MANAGEMENT ENDPOINTS
# ============================================================================

@app.get("/api/baselines", response_model=ProjectBaselinesResponse)
async def get_baselines():
    """
    Get summary of all baselines set in the current project.
    Returns list of baselines with their number, task count, and set date.
    """
    global current_project_id
    if not current_project_id:
        raise HTTPException(status_code=400, detail="No project loaded")

    try:
        baselines = db.get_project_baselines(current_project_id)
        tasks = db.get_tasks(current_project_id)

        baseline_infos = [
            BaselineInfo(
                number=b['number'],
                set_date=b['set_date'],
                task_count=b['task_count']
            ) for b in baselines
        ]

        return ProjectBaselinesResponse(
            baselines=baseline_infos,
            total_tasks=len(tasks)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get baselines: {str(e)}")


@app.post("/api/baselines/set")
async def set_baseline(request: SetBaselineRequest):
    """
    Set a baseline for the current project.
    Captures the current schedule (start, finish, duration) as the baseline.

    MS Project supports baselines 0-10. Baseline 0 is the primary baseline.
    """
    global current_project_id
    if not current_project_id:
        raise HTTPException(status_code=400, detail="No project loaded")

    try:
        count = db.set_baseline(
            current_project_id,
            request.baseline_number,
            request.task_ids
        )

        return {
            "success": True,
            "message": f"Baseline {request.baseline_number} set for {count} tasks",
            "baseline_number": request.baseline_number,
            "tasks_baselined": count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to set baseline: {str(e)}")


@app.post("/api/baselines/clear")
async def clear_baseline(request: ClearBaselineRequest):
    """
    Clear a baseline from the current project.

    Args:
        baseline_number: Baseline number to clear (0-10)
        task_ids: Optional list of task IDs. If None, clears all tasks.
    """
    global current_project_id
    if not current_project_id:
        raise HTTPException(status_code=400, detail="No project loaded")

    try:
        count = db.clear_baseline(
            current_project_id,
            request.baseline_number,
            request.task_ids
        )

        return {
            "success": True,
            "message": f"Baseline {request.baseline_number} cleared from {count} tasks",
            "baseline_number": request.baseline_number,
            "tasks_cleared": count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear baseline: {str(e)}")


# ============================================================================
# AI PROJECT EDITOR ENDPOINTS
# ============================================================================

@app.post("/api/ai/edit", response_model=AIEditResult)
async def execute_ai_edit_command(request: AIEditCommandRequest):
    """
    Execute an AI project editing command using natural language.

    Supported commands:
    - Move task: "move task 1.3 under phase 2", "move task 1.2 after 2.1"
    - Insert task: "insert task 'Electrical rough-in' after 2.3"
    - Delete task: "delete task 1.4"
    - Merge tasks: "merge tasks 1.2 and 1.3"
    - Split task: "split task 1.2 into 3 parts"
    - Auto-sequence: "sequence all tasks", "reorganize project"
    - Reorganize phase: "reorganize phase 2"
    - Update dependencies: "update all dependencies"
    - Create phase: "create phase 'Interior Work' after 2"

    Returns the changes made and updates the project in database.
    """
    global current_project, current_project_id

    try:
        # Determine which project to use
        target_project = current_project
        target_project_id = current_project_id

        if request.project_id:
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
            else:
                raise HTTPException(status_code=404, detail=f"Project {request.project_id} not found")

        if not target_project:
            raise HTTPException(status_code=404, detail="No project loaded")

        # Parse the command
        command = ai_project_editor.parse_command(request.command)

        if not command:
            # Try the basic command handler as fallback
            basic_command = ai_command_handler.parse_command(request.command)
            if basic_command:
                result = ai_command_handler.execute_command(basic_command, target_project)

                # MANUAL SAVE MODE: Changes kept in memory only until user saves
                if result["success"]:
                    # Update in-memory if this is the current project
                    if target_project_id == current_project_id:
                        current_project = target_project
                    # Note: User must click Save to persist changes

                return AIEditResult(
                    success=result["success"],
                    message=result["message"],
                    command_type=basic_command["action"],
                    changes=[],
                    tasks_affected=len(result.get("changes", []))
                )

            return AIEditResult(
                success=False,
                message=f"Could not understand command: '{request.command}'. Try commands like 'move task 1.2 under phase 2' or 'delete task 1.3'",
                command_type=None,
                changes=[],
                tasks_affected=0
            )

        # Execute the command
        result = ai_project_editor.execute_command(command, target_project)

        if result["success"]:
            # Update the project with modified tasks
            updated_project = result.get("project", target_project)

            # Update in-memory state if this is the current project
            if target_project_id == current_project_id:
                current_project = updated_project

            # MANUAL SAVE MODE: Changes kept in memory only until user saves
            # existing_task_ids = {t["id"] for t in db.get_tasks(target_project_id)}
            # new_task_ids = {t["id"] for t in updated_project.get("tasks", [])}
            # for task_id in existing_task_ids - new_task_ids:
            #     db.delete_task(task_id)
            # for task in updated_project.get("tasks", []):
            #     if task["id"] in existing_task_ids:
            #         db.update_task(task["id"], task)
            #     else:
            #         db.create_task(target_project_id, task)
            # save_project_to_db()
            # Note: User must click Save to persist changes

        # Convert changes to response format
        changes = [
            {
                "type": c.get("type", "unknown"),
                "task_name": c.get("task_name"),
                "old_outline": c.get("old_outline"),
                "new_outline": c.get("new_outline"),
                "description": c.get("description", str(c))
            }
            for c in result.get("changes", [])
        ]

        return AIEditResult(
            success=result["success"],
            message=result["message"],
            command_type=command["action"],
            changes=changes,
            tasks_affected=len(changes)
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"AI edit error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI edit failed: {str(e)}")


@app.post("/api/ai/suggest", response_model=AISuggestionsResult)
async def get_ai_suggestions(request: AISuggestionRequest):
    """
    Get AI-powered suggestions for improving the project structure.

    Analyzes the project and returns suggestions for:
    - Task reorganization
    - Dependency improvements
    - Sequence optimizations
    - Phase restructuring
    - Task merging/splitting opportunities
    """
    global current_project, current_project_id

    try:
        # Determine which project to analyze
        target_project = current_project
        target_project_id = current_project_id

        if request.project_id:
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
            else:
                raise HTTPException(status_code=404, detail=f"Project {request.project_id} not found")

        if not target_project:
            raise HTTPException(status_code=404, detail="No project loaded")

        tasks = target_project.get("tasks", [])
        suggestions = []
        suggestion_id = 0

        # Analyze for sequence issues
        if request.suggestion_type in ["all", "sequence"]:
            work_tasks = [t for t in tasks if not t.get("summary") and not t.get("milestone")]

            for i, task in enumerate(work_tasks):
                category = ai_project_editor._detect_construction_category(task["name"])
                order = ai_project_editor.construction_sequence.get(category, 99)

                # Check if task is out of sequence
                if i > 0:
                    prev_task = work_tasks[i-1]
                    prev_category = ai_project_editor._detect_construction_category(prev_task["name"])
                    prev_order = ai_project_editor.construction_sequence.get(prev_category, 99)

                    # Skip if either task is 'general' (unknown category) - we can't reliably sequence them
                    if category == 'general' or prev_category == 'general':
                        continue

                    # If current task should come BEFORE previous task in construction sequence
                    if order < prev_order - 1:  # Significantly out of order
                        suggestion_id += 1
                        # Suggest moving the PREVIOUS task later (after current), not current earlier
                        # Because the current task is correctly positioned, it's the previous that's wrong
                        suggestions.append(AISuggestion(
                            id=f"seq_{suggestion_id}",
                            type="sequence",
                            priority="high",
                            title=f"Reorder '{prev_task['name'][:30]}...'",
                            description=f"Task '{prev_task['name']}' ({prev_category}) appears to be out of construction sequence. It should come after '{task['name']}' ({category}).",
                            command=f"move task {prev_task['outline_number']} after {task['outline_number']}",
                            affected_tasks=[prev_task["outline_number"], task["outline_number"]],
                            estimated_improvement="Better construction sequence flow"
                        ))

        # Analyze for missing dependencies
        if request.suggestion_type in ["all", "dependencies"]:
            for task in tasks:
                if task.get("summary") or task.get("milestone"):
                    continue

                has_predecessors = len(task.get("predecessors", [])) > 0
                category = ai_project_editor._detect_construction_category(task["name"])
                order = ai_project_editor.construction_sequence.get(category, 99)

                # If task is not early phase and has no predecessors, suggest adding some
                if not has_predecessors and order > 3:
                    suggestion_id += 1
                    suggestions.append(AISuggestion(
                        id=f"dep_{suggestion_id}",
                        type="dependency",
                        priority="medium",
                        title=f"Add predecessor to '{task['name'][:25]}...'",
                        description=f"Task '{task['name']}' has no predecessors but is a mid/late-phase task ({category}). Consider adding logical dependencies.",
                        command="update all dependencies",
                        affected_tasks=[task["outline_number"]],
                        estimated_improvement="Proper dependency chain"
                    ))

        # Analyze for phase reorganization opportunities
        if request.suggestion_type in ["all", "phases", "reorganize"]:
            phases = [t for t in tasks if t.get("summary") and t.get("outline_level", 0) == 1]

            for phase in phases:
                children = ai_project_editor._get_direct_children(tasks, phase["outline_number"])
                if len(children) >= 3:
                    # Check if children are in good order
                    categories = [ai_project_editor._detect_construction_category(c["name"]) for c in children]
                    orders = [ai_project_editor.construction_sequence.get(c, 99) for c in categories]

                    if orders != sorted(orders):
                        suggestion_id += 1
                        suggestions.append(AISuggestion(
                            id=f"phase_{suggestion_id}",
                            type="reorganize",
                            priority="medium",
                            title=f"Reorganize '{phase['name'][:25]}...'",
                            description=f"Phase '{phase['name']}' has {len(children)} tasks that could be better ordered based on construction sequence.",
                            command=f"reorganize phase {phase['outline_number']}",
                            affected_tasks=[c["outline_number"] for c in children],
                            estimated_improvement="Optimized task order within phase"
                        ))

        # Analyze for merge opportunities (similar adjacent tasks)
        if request.suggestion_type in ["all", "reorganize"]:
            work_tasks = [t for t in tasks if not t.get("summary") and not t.get("milestone")]

            for i in range(len(work_tasks) - 1):
                task1 = work_tasks[i]
                task2 = work_tasks[i + 1]

                # Check if tasks have similar names (potential merge candidates)
                name1_words = set(task1["name"].lower().split())
                name2_words = set(task2["name"].lower().split())
                overlap = name1_words & name2_words

                if len(overlap) >= 2 and len(overlap) / max(len(name1_words), len(name2_words)) > 0.5:
                    suggestion_id += 1
                    suggestions.append(AISuggestion(
                        id=f"merge_{suggestion_id}",
                        type="merge",
                        priority="low",
                        title=f"Consider merging similar tasks",
                        description=f"Tasks '{task1['name']}' and '{task2['name']}' appear similar and might be candidates for merging.",
                        command=f"merge tasks {task1['outline_number']} and {task2['outline_number']}",
                        affected_tasks=[task1["outline_number"], task2["outline_number"]],
                        estimated_improvement="Simplified project structure"
                    ))

        # Sort suggestions by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        suggestions.sort(key=lambda s: priority_order.get(s.priority, 99))

        # Limit to top 20 suggestions
        suggestions = suggestions[:20]

        return AISuggestionsResult(
            success=True,
            suggestions=suggestions,
            project_analyzed=target_project.get("name", "Unknown"),
            total_tasks=len(tasks)
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"AI suggestion error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI suggestion failed: {str(e)}")


@app.post("/api/ai/apply-suggestion")
async def apply_ai_suggestion(request: ApplySuggestionRequest):
    """
    Apply a specific AI suggestion to the project.
    Executes the command associated with the suggestion.
    """
    # Reuse the edit endpoint logic
    edit_request = AIEditCommandRequest(
        command=request.command,
        project_id=request.project_id
    )
    return await execute_ai_edit_command(edit_request)


@app.post("/api/ai/learn-template", response_model=LearnedTemplate)
async def learn_from_projects(request: TemplateLearnRequest):
    """
    Learn patterns from existing projects to improve AI generation.

    Analyzes historical projects to extract:
    - Common phase structures
    - Task naming patterns and typical durations
    - Dependency patterns
    - Milestone patterns

    Returns learned template data that can be used for generating new projects.
    """
    try:
        # Get projects to learn from
        if request.project_ids:
            projects = []
            for pid in request.project_ids[:request.max_projects]:
                project_data = db.get_project(pid)
                if project_data:
                    tasks = db.get_tasks(pid)
                    projects.append({
                        "name": project_data["name"],
                        "tasks": tasks
                    })
        else:
            # Get all projects
            all_projects = db.list_projects()
            projects = []
            for p in all_projects[:request.max_projects]:
                tasks = db.get_tasks(p['id'])
                projects.append({
                    "name": p["name"],
                    "tasks": tasks
                })

        if not projects:
            return LearnedTemplate(
                project_type="unknown",
                common_phases=[],
                common_tasks=[],
                common_milestones=[],
                duration_norms={},
                projects_analyzed=0
            )

        # Learn from projects
        patterns = project_template_learner.learn_from_multiple_projects(projects)

        # Generate template
        template = project_template_learner.generate_template(patterns)

        # Convert to response format
        common_phases = list(patterns.get("common_phases", {}).keys())[:10]
        common_tasks = [
            {"name": name, "frequency": data.get("count", 0), "avg_duration_hours": data.get("avg_duration_hours", 8)}
            for name, data in list(patterns.get("task_name_frequency", {}).items())[:20]
        ]
        common_milestones = list(patterns.get("common_milestones", {}).keys())[:10]

        return LearnedTemplate(
            project_type=template.get("project_type", "commercial"),
            common_phases=common_phases,
            common_tasks=common_tasks,
            common_milestones=common_milestones,
            duration_norms=patterns.get("category_duration_norms", {}),
            projects_analyzed=len(projects)
        )

    except Exception as e:
        print(f"Template learning error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Template learning failed: {str(e)}")


@app.post("/api/ai/auto-reorganize")
async def auto_reorganize_project(project_id: Optional[str] = None):
    """
    Automatically reorganize the entire project based on construction best practices.

    This applies the 'auto_sequence' command which:
    1. Analyzes all tasks by construction category
    2. Reorders tasks based on logical construction sequence
    3. Updates dependencies to reflect the new order

    Returns the changes made and the optimized project structure.
    """
    edit_request = AIEditCommandRequest(
        command="auto sequence all tasks",
        project_id=project_id
    )
    return await execute_ai_edit_command(edit_request)


@app.post("/api/ai/generate-from-template")
async def generate_project_from_template(
    description: str,
    project_type: str = "commercial",
    use_learned_patterns: bool = True
):
    """
    Generate a new project using learned patterns from existing projects.

    Enhanced project generation that:
    1. First learns patterns from all existing projects
    2. Uses those patterns to generate a more consistent project
    3. Maintains company-specific naming conventions and durations
    """
    global current_project, current_project_id

    try:
        # Get historical project data
        historical_data = []

        if use_learned_patterns:
            all_projects = db.list_projects()
            for p in all_projects[:10]:  # Use up to 10 projects for learning
                tasks = db.get_tasks(p['id'])
                historical_data.append({
                    "name": p["name"],
                    "tasks": tasks
                })

        # Generate project using AI with learned patterns
        result = await ai_service.generate_project(
            description=description,
            project_type=project_type,
            historical_data=historical_data
        )

        if not result.get("success", False):
            raise HTTPException(
                status_code=500,
                detail=f"AI project generation failed: {result.get('error', 'Unknown error')}"
            )

        project_name = result.get("project_name", "AI Generated Project")
        start_date = result.get("start_date", datetime.now().strftime("%Y-%m-%d"))
        tasks = result.get("tasks", [])

        # Create new project
        project_id = db.create_project(
            name=project_name,
            start_date=start_date,
            status_date=start_date
        )

        # Add project_id and generate UIDs for each task
        import uuid
        for task in tasks:
            task["id"] = str(uuid.uuid4())
            task["uid"] = task["id"]
            task["project_id"] = project_id

        # Insert generated tasks
        if tasks:
            db.bulk_create_tasks(project_id, tasks)

        # Update in-memory state
        current_project = {
            "name": project_name,
            "start_date": start_date,
            "status_date": start_date,
            "tasks": tasks
        }
        current_project_id = project_id

        xml_processor.xml_root = None

        return {
            "success": True,
            "project_id": project_id,
            "project_name": project_name,
            "task_count": len(tasks),
            "learned_from": len(historical_data),
            "message": f"Generated project '{project_name}' with {len(tasks)} tasks using patterns from {len(historical_data)} existing projects"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Template-based generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate project: {str(e)}")


# ==================== STATIC FILE SERVING (Production) ====================
# Serve frontend static files in production

STATIC_DIR = Path("static")

if STATIC_DIR.exists():
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    # Serve other static files from root
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend for all non-API routes (SPA fallback)"""
        # Skip API routes
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")

        # Try to serve the exact file
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)

        # Fallback to index.html for SPA routing
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)

        raise HTTPException(status_code=404, detail="Not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
