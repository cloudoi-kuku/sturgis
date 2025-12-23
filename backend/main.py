from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import xml.etree.ElementTree as ET
from datetime import datetime
import os

from models import (
    ProjectConfig,
    Task,
    TaskCreate,
    TaskUpdate,
    Predecessor,
    ValidationResult,
    ProjectMetadata
)
from xml_processor import MSProjectXMLProcessor
from validator import ProjectValidator

app = FastAPI(title="MS Project Configuration API", version="1.0.0")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for the current project state
current_project: Optional[Dict[str, Any]] = None
xml_processor = MSProjectXMLProcessor()
validator = ProjectValidator()


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
        raise HTTPException(status_code=500, detail=f"Error generating XML: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

