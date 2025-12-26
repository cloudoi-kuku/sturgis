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
    ChatRequest
)
from xml_processor import MSProjectXMLProcessor
from validator import ProjectValidator
from ai_service import ai_service

app = FastAPI(title="MS Project Configuration API", version="1.0.0")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage configuration
STORAGE_DIR = Path("project_data")
STORAGE_DIR.mkdir(exist_ok=True)
CURRENT_PROJECT_FILE = STORAGE_DIR / "current_project.json"
XML_TEMPLATE_FILE = STORAGE_DIR / "xml_template.xml"

# In-memory storage for the current project state
current_project: Optional[Dict[str, Any]] = None
xml_processor = MSProjectXMLProcessor()
validator = ProjectValidator()


def save_project_to_disk():
    """Save current project and XML template to disk"""
    if current_project:
        try:
            # Save project data
            with open(CURRENT_PROJECT_FILE, 'w', encoding='utf-8') as f:
                json.dump(current_project, f, indent=2, ensure_ascii=False)

            # Save XML template if available
            if xml_processor.xml_root is not None:
                xml_str = ET.tostring(xml_processor.xml_root, encoding='unicode')
                with open(XML_TEMPLATE_FILE, 'w', encoding='utf-8') as f:
                    f.write(xml_str)

            print(f"Saved project to disk: {current_project.get('name', 'Unknown')}")
        except Exception as e:
            print(f"Error saving project to disk: {e}")


def load_project_from_disk():
    """Load project and XML template from disk on startup"""
    global current_project
    if CURRENT_PROJECT_FILE.exists():
        try:
            # Load project data
            with open(CURRENT_PROJECT_FILE, 'r', encoding='utf-8') as f:
                current_project = json.load(f)

            # Load XML template if available
            if XML_TEMPLATE_FILE.exists():
                with open(XML_TEMPLATE_FILE, 'r', encoding='utf-8') as f:
                    xml_content = f.read()
                    xml_processor.xml_root = ET.fromstring(xml_content)
                    print(f"Loaded XML template from disk")

            print(f"Loaded project from disk: {current_project.get('name', 'Unknown')}")
        except Exception as e:
            print(f"Error loading project from disk: {e}")


# Load project on startup
@app.on_event("startup")
async def startup_event():
    """Load saved project on server startup"""
    load_project_from_disk()


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "MS Project Configuration API"}


@app.post("/api/project/upload")
async def upload_project(file: UploadFile = File(...)):
    """Upload and parse an MS Project XML file"""
    global current_project
    
    if not file.filename.endswith('.xml'):
        raise HTTPException(status_code=400, detail="File must be an XML file")
    
    try:
        content = await file.read()
        xml_content = content.decode('utf-8')
        
        # Parse the XML and extract project data
        project_data = xml_processor.parse_xml(xml_content)
        current_project = project_data

        # Save to disk
        save_project_to_disk()

        return {
            "success": True,
            "message": "Project uploaded successfully",
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
    
    if not current_project:
        raise HTTPException(status_code=404, detail="No project loaded")
    
    current_project["name"] = metadata.name
    current_project["start_date"] = metadata.start_date
    current_project["status_date"] = metadata.status_date

    # Save to disk
    save_project_to_disk()

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
    
    if not current_project:
        raise HTTPException(status_code=404, detail="No project loaded")
    
    # Validate the task
    validation = validator.validate_task(task.dict(), current_project.get("tasks", []))
    if not validation["valid"]:
        raise HTTPException(status_code=400, detail=validation["errors"])
    
    # Add the task
    new_task = xml_processor.add_task(current_project, task.dict())

    # Save to disk
    save_project_to_disk()

    return {"success": True, "task": new_task}


@app.put("/api/tasks/{task_id}")
async def update_task(task_id: str, task: TaskUpdate):
    """Update an existing task"""
    global current_project

    if not current_project:
        raise HTTPException(status_code=404, detail="No project loaded")

    # Update the task
    updates = task.dict(exclude_unset=True)
    print(f"DEBUG: Updating task {task_id} with updates: {updates}")
    updated_task = xml_processor.update_task(current_project, task_id, updates)

    if not updated_task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Save to disk
    save_project_to_disk()

    print(f"DEBUG: Updated task result: {updated_task}")
    return {"success": True, "task": updated_task}


@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    """Delete a task"""
    global current_project

    if not current_project:
        raise HTTPException(status_code=404, detail="No project loaded")

    success = xml_processor.delete_task(current_project, task_id)

    if not success:
        raise HTTPException(status_code=404, detail="Task not found")

    # Save to disk
    save_project_to_disk()

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
    Conversational AI chat for construction project assistance
    Returns AI response as text
    """
    try:
        response = await ai_service.chat(
            user_message=request.message,
            project_context=current_project  # ← Context-aware chat!
        )
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@app.post("/api/ai/chat/clear")
async def clear_chat_history():
    """Clear chat conversation history"""
    ai_service.clear_chat_history()
    return {"success": True, "message": "Chat history cleared"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

