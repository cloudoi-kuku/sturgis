from fastapi import FastAPI, UploadFile, File, HTTPException
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
    ProjectBaselinesResponse
)
from xml_processor import MSProjectXMLProcessor
from validator import ProjectValidator
from ai_service import ai_service
from ai_command_handler import ai_command_handler
from database import DatabaseService
from auth import router as auth_router

app = FastAPI(title="MS Project Configuration API", version="1.0.0")

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

# Initialize database service
db = DatabaseService()

# In-memory cache for the current project state (for backward compatibility)
current_project: Optional[Dict[str, Any]] = None
current_project_id: Optional[str] = None
xml_processor = MSProjectXMLProcessor()
validator = ProjectValidator()


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


# Load project on startup
@app.on_event("startup")
async def startup_event():
    """Load saved project on server startup"""
    load_project_from_db()


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
async def get_all_projects():
    """Get list of all saved projects"""
    projects = db.list_projects()
    # Format for frontend compatibility
    formatted_projects = []
    for p in projects:
        formatted_projects.append({
            "id": p['id'],
            "name": p['name'],
            "task_count": p['task_count'],
            "start_date": p['start_date'],
            "is_active": bool(p['is_active'])
        })
    return {"projects": formatted_projects}


@app.post("/api/projects/new")
async def create_new_project(name: str = "New Project"):
    """Create a new empty project"""
    global current_project, current_project_id

    # Create project in database
    project_id = db.create_project(
        name=name,
        start_date=datetime.now().strftime("%Y-%m-%d"),
        status_date=datetime.now().strftime("%Y-%m-%d")
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
async def switch_project(project_id: str):
    """Switch to a different project"""
    global current_project, current_project_id

    if load_project_from_db(project_id):
        return {
            "success": True,
            "message": "Switched to project",
            "project_id": project_id,
            "project": current_project
        }
    else:
        raise HTTPException(status_code=404, detail="Project not found")


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
async def upload_project(file: UploadFile = File(...)):
    """Upload and parse an MS Project XML file - creates a new project"""
    global current_project, current_project_id

    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="File must be an XML file")

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
            xml_template=xml_content
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
    """Get current project metadata"""
    if not current_project:
        raise HTTPException(status_code=404, detail="No project loaded")

    return {
        "project_id": current_project_id,
        "name": current_project.get("name"),
        "start_date": current_project.get("start_date"),
        "status_date": current_project.get("status_date"),
        "task_count": len(current_project.get("tasks", []))
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


@app.get("/api/tasks")
async def get_tasks():
    """Get all tasks in the current project"""
    if not current_project:
        raise HTTPException(status_code=404, detail="No project loaded")

    # Ensure summary tasks are calculated before returning
    current_project["tasks"] = xml_processor._calculate_summary_tasks(current_project.get("tasks", []))

    return {"tasks": current_project.get("tasks", [])}


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

    # Save the new task to database
    db.create_task(current_project_id, new_task)

    # Update all tasks in database to reflect summary status changes
    # (parent tasks may have become summary tasks)
    for task in current_project.get("tasks", []):
        if task["id"] != new_task["id"]:  # Don't update the new task twice
            db.update_task(task["id"], task)

    # Save XML template
    save_project_to_db()

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

    # Update all tasks in database to reflect summary status changes
    for task in current_project.get("tasks", []):
        db.update_task(task["id"], task)

    # Save XML template
    save_project_to_db()

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

    # Delete from database
    db.delete_task(task_id)

    # Update all remaining tasks in database to reflect summary status changes
    # (parent tasks may no longer be summary tasks if all children were deleted)
    for task in current_project.get("tasks", []):
        db.update_task(task["id"], task)

    # Save XML template
    save_project_to_db()

    return {"success": True, "message": "Task deleted successfully"}


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
    """Check if local AI service (Ollama) is available"""
    is_healthy = await ai_service.health_check()
    return {
        "status": "healthy" if is_healthy else "unavailable",
        "model": ai_service.model,
        "provider": "Ollama (Local)"
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


@app.post("/api/ai/chat")
async def chat_with_ai(request: ChatRequest):
    """
    Conversational AI chat for construction project assistance with command execution
    Can answer questions AND modify tasks/project based on natural language commands
    Returns AI response as text, plus any modifications made

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

        # First, check if the message contains a command
        command = ai_command_handler.parse_command(request.message)

        if command and target_project:
            # Execute the command on the target project
            result = ai_command_handler.execute_command(command, target_project)

            if result["success"]:
                # Save changes to database
                if request.project_id:
                    # Save to the specific project
                    for task in target_project.get("tasks", []):
                        db.update_task(task["id"], task)
                else:
                    # Save to current project
                    save_project_to_db()

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
async def generate_project_from_description(request: GenerateProjectRequest):
    """
    Generate a complete construction project from a natural language description.
    Can either create a new project OR populate an existing empty project.

    Returns: {
        "success": bool,
        "project_id": str,
        "project_name": str,
        "task_count": int,
        "message": str
    }
    """
    global current_project, current_project_id

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
                status_date=start_date
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

        # Update in-memory state
        current_project = {
            "name": project_name,
            "start_date": start_date,
            "status_date": start_date,
            "tasks": tasks
        }
        current_project_id = project_id

        # Clear XML template for AI-generated project
        xml_processor.xml_root = None

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

        # Save updated project to database
        # Need to update all modified tasks in the database
        for task in current_project.get("tasks", []):
            db.update_task(task['id'], task)

        save_project_to_db()

        return {
            "success": True,
            "message": f"Applied {changes_applied} changes successfully",
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
