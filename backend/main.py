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
    ApplyOptimizationRequest
)
from xml_processor import MSProjectXMLProcessor
from validator import ProjectValidator
from ai_service import ai_service
from ai_command_handler import ai_command_handler
from database import DatabaseService

app = FastAPI(title="MS Project Configuration API", version="1.0.0")

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
    """Health check endpoint"""
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
        content = await file.read()
        xml_content = content.decode('utf-8')

        # Parse the XML and extract project data
        project_data = xml_processor.parse_xml(xml_content)

        # Create project in database
        project_id = db.create_project(
            name=project_data.get('name', 'Imported Project'),
            start_date=project_data.get('start_date', datetime.now().strftime("%Y-%m-%d")),
            status_date=project_data.get('status_date', datetime.now().strftime("%Y-%m-%d")),
            xml_template=xml_content
        )

        # Bulk insert tasks
        tasks = project_data.get('tasks', [])
        if tasks:
            db.bulk_create_tasks(project_id, tasks)

        # Update in-memory state
        current_project = project_data
        current_project_id = project_id

        return {
            "success": True,
            "message": "Project uploaded successfully",
            "project_id": project_id,
            "project": project_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing XML: {str(e)}")


@app.get("/api/project/metadata")
async def get_project_metadata():
    """Get current project metadata"""
    if not current_project:
        raise HTTPException(status_code=404, detail="No project loaded")
    
    return {
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
    new_task = xml_processor.add_task(current_project, task_dict)

    # Save to database
    db.create_task(current_project_id, new_task)

    # Save XML template
    save_project_to_db()

    return {"success": True, "task": new_task}


@app.put("/api/tasks/{task_id}")
async def update_task(task_id: str, task: TaskUpdate):
    """Update an existing task"""
    global current_project

    if not current_project or not current_project_id:
        raise HTTPException(status_code=404, detail="No project loaded")

    # Update the task in memory
    updates = task.model_dump(exclude_unset=True)
    print(f"DEBUG: Updating task {task_id} with updates: {updates}")
    updated_task = xml_processor.update_task(current_project, task_id, updates)

    if not updated_task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Update in database
    db.update_task(task_id, updated_task)

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

    success = xml_processor.delete_task(current_project, task_id)

    if not success:
        raise HTTPException(status_code=404, detail="Task not found")

    # Delete from database
    db.delete_task(task_id)

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
    """
    global current_project

    try:
        # First, check if the message contains a command
        command = ai_command_handler.parse_command(request.message)

        if command and current_project:
            # Execute the command
            result = ai_command_handler.execute_command(command, current_project)

            if result["success"]:
                # Save changes to database
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

        # No command detected, use normal AI chat
        response = await ai_service.chat(
            user_message=request.message,
            project_context=current_project
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
    Creates a new project with tasks, durations, dependencies, and dates.

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
        # Generate project using AI
        result = await ai_service.generate_project(
            description=request.description,
            project_type=request.project_type
        )

        if not result.get("success", False):
            raise HTTPException(
                status_code=500,
                detail=f"AI project generation failed: {result.get('error', 'Unknown error')}"
            )

        # Create project in database
        project_name = result.get("project_name", "AI Generated Project")
        start_date = result.get("start_date", datetime.now().strftime("%Y-%m-%d"))

        project_id = db.create_project(
            name=project_name,
            start_date=start_date,
            status_date=start_date
        )

        # Bulk insert generated tasks
        tasks = result.get("tasks", [])
        if tasks:
            # Add project_id and generate UIDs for each task
            import uuid
            for task in tasks:
                task["id"] = str(uuid.uuid4())
                task["uid"] = task["id"]
                task["project_id"] = project_id

            db.bulk_create_tasks(project_id, tasks)

        # Update in-memory state to the new project
        current_project = {
            "name": project_name,
            "start_date": start_date,
            "status_date": start_date,
            "tasks": tasks
        }
        current_project_id = project_id

        # Clear XML template for AI-generated project
        xml_processor.xml_root = None

        return {
            "success": True,
            "project_id": project_id,
            "project_name": project_name,
            "task_count": len(tasks),
            "message": f"Successfully generated project '{project_name}' with {len(tasks)} tasks"
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

