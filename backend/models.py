from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class Predecessor(BaseModel):
    """Task predecessor/dependency model"""
    outline_number: str = Field(..., description="Outline number of the predecessor task")
    type: int = Field(default=1, description="Dependency type: 1=FS, 2=SS, 3=FF, 4=SF")
    lag: int = Field(default=0, description="Lag time in the specified format")
    lag_format: int = Field(default=7, description="Lag format: 7=days, 8=hours")


class TaskBase(BaseModel):
    """Base task model with common fields"""
    name: str = Field(..., description="Task name")
    outline_number: str = Field(..., description="Task outline number (e.g., 1.2.3)")
    duration: Optional[str] = Field(default="PT8H0M0S", description="Duration in ISO 8601 format")
    value: Optional[str] = Field(default="", description="Custom field value")
    milestone: bool = Field(default=False, description="Whether this is a milestone")
    percent_complete: int = Field(default=0, ge=0, le=100, description="Percent complete (0-100)")
    predecessors: List[Predecessor] = Field(default_factory=list, description="List of predecessor tasks")


class TaskCreate(TaskBase):
    """Model for creating a new task"""
    pass


class TaskUpdate(BaseModel):
    """Model for updating an existing task (all fields optional)"""
    name: Optional[str] = None
    outline_number: Optional[str] = None
    duration: Optional[str] = None
    value: Optional[str] = None
    milestone: Optional[bool] = None
    percent_complete: Optional[int] = Field(default=None, ge=0, le=100)
    predecessors: Optional[List[Predecessor]] = None


class Task(TaskBase):
    """Full task model with all fields"""
    id: str = Field(..., description="Unique task ID")
    uid: str = Field(..., description="Unique task UID")
    outline_level: int = Field(..., description="Outline level (depth in hierarchy)")
    start_date: Optional[str] = None
    finish_date: Optional[str] = None
    summary: bool = Field(default=False, description="Whether this is a summary task")


class ProjectMetadata(BaseModel):
    """Project metadata model"""
    name: str = Field(..., description="Project name")
    start_date: str = Field(..., description="Project start date in ISO 8601 format")
    status_date: str = Field(..., description="Project status date in ISO 8601 format")


class ProjectConfig(BaseModel):
    """Complete project configuration"""
    metadata: ProjectMetadata
    tasks: List[Task]


class ValidationError(BaseModel):
    """Validation error model"""
    field: str
    message: str
    task_id: Optional[str] = None


class ValidationResult(BaseModel):
    """Validation result model"""
    valid: bool
    errors: List[ValidationError] = Field(default_factory=list)
    warnings: List[ValidationError] = Field(default_factory=list)

