from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class Predecessor(BaseModel):
    """Task predecessor/dependency model"""
    outline_number: str = Field(..., description="Outline number of the predecessor task")
    type: int = Field(default=1, description="Dependency type: 0=FF, 1=FS, 2=SF, 3=SS (per MS Project XML schema)")
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

# AI Models
class DurationEstimateRequest(BaseModel):
    task_name: str
    task_type: str = ""

class DependencyDetectionRequest(BaseModel):
    tasks: List[Dict]

class TaskCategorizationRequest(BaseModel):
    task_name: str

class ChatRequest(BaseModel):
    message: str

# Project Optimization Models (MS Project Compliant)
class OptimizeDurationRequest(BaseModel):
    """Request to optimize project duration"""
    target_days: int = Field(..., description="Target project duration in days", gt=0)

class OptimizationChange(BaseModel):
    """Represents a single change in an optimization strategy"""
    task_id: str = Field(..., description="Task ID to modify")
    task_name: str = Field(..., description="Task name for display")
    task_outline: str = Field(..., description="Task outline number")
    change_type: str = Field(..., description="Type of change: lag_reduction, duration_compression, dependency_change")
    current_value: float = Field(..., description="Current value (days)")
    suggested_value: float = Field(..., description="Suggested new value (days)")
    savings_days: float = Field(..., description="Time savings in days")
    cost_usd: float = Field(default=0, description="Estimated cost impact in USD")
    risk_level: str = Field(default="Low", description="Risk level: Low, Medium, High")
    description: str = Field(..., description="Human-readable description of the change")

    # MS Project specific fields
    predecessor_outline: Optional[str] = Field(default=None, description="For lag changes: predecessor outline number")
    lag_format: Optional[int] = Field(default=7, description="MS Project lag format: 7=days, 8=hours")
    duration_format: Optional[str] = Field(default=None, description="MS Project duration format (ISO 8601)")

class OptimizationStrategy(BaseModel):
    """Represents a complete optimization strategy"""
    strategy_id: str = Field(..., description="Unique strategy identifier")
    name: str = Field(..., description="Strategy name")
    type: str = Field(..., description="Strategy type: lag_reduction, task_compression, fast_tracking, combined")
    total_savings_days: float = Field(..., description="Total time savings in days")
    total_cost_usd: float = Field(default=0, description="Total estimated cost in USD")
    risk_level: str = Field(..., description="Overall risk level: Low, Medium, High")
    recommended: bool = Field(default=False, description="Whether this is the recommended strategy")
    description: str = Field(..., description="Strategy description")
    changes: List[OptimizationChange] = Field(..., description="List of changes in this strategy")

    # Impact analysis
    tasks_affected: int = Field(..., description="Number of tasks affected")
    critical_path_impact: bool = Field(default=True, description="Whether this affects critical path")

class OptimizationResult(BaseModel):
    """Result of project duration optimization analysis"""
    success: bool = Field(..., description="Whether optimization was successful")
    message: str = Field(..., description="Result message")
    current_duration_days: float = Field(..., description="Current project duration in days")
    target_duration_days: int = Field(..., description="Target project duration in days")
    reduction_needed_days: float = Field(..., description="Reduction needed in days")
    achievable: bool = Field(..., description="Whether target is achievable")
    strategies: List[OptimizationStrategy] = Field(default_factory=list, description="Available optimization strategies")
    critical_path_tasks: List[str] = Field(default_factory=list, description="Tasks on critical path")

class ApplyOptimizationRequest(BaseModel):
    """Request to apply an optimization strategy"""
    strategy_id: str = Field(..., description="ID of strategy to apply")
    changes: List[OptimizationChange] = Field(..., description="Changes to apply")

