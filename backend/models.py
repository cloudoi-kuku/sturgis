from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import IntEnum


class ConstraintType(IntEnum):
    """MS Project compatible task constraint types"""
    AS_SOON_AS_POSSIBLE = 0      # Default - schedule task as early as possible
    AS_LATE_AS_POSSIBLE = 1      # Schedule task as late as possible
    MUST_START_ON = 2            # Task must start on the constraint date
    MUST_FINISH_ON = 3           # Task must finish on the constraint date
    START_NO_EARLIER_THAN = 4    # Task cannot start before the constraint date
    START_NO_LATER_THAN = 5      # Task must start by the constraint date
    FINISH_NO_EARLIER_THAN = 6   # Task cannot finish before the constraint date
    FINISH_NO_LATER_THAN = 7     # Task must finish by the constraint date


class Predecessor(BaseModel):
    """Task predecessor/dependency model"""
    outline_number: str = Field(..., description="Outline number of the predecessor task")
    type: int = Field(default=1, description="Dependency type: 0=FF, 1=FS, 2=SF, 3=SS (per MS Project XML schema)")
    lag: int = Field(default=0, description="Lag time in the specified format")
    lag_format: int = Field(default=7, description="Lag format: 7=days, 8=hours")


class TaskBaseline(BaseModel):
    """MS Project Baseline model - captures a snapshot of task schedule at a point in time.
    MS Project supports up to 11 baselines (0-10) per task."""
    number: int = Field(..., ge=0, le=10, description="Baseline number (0-10). 0 is the primary baseline.")
    start: Optional[str] = Field(default=None, description="Baseline start date in ISO 8601 format")
    finish: Optional[str] = Field(default=None, description="Baseline finish date in ISO 8601 format")
    duration: Optional[str] = Field(default=None, description="Baseline duration in ISO 8601 duration format (e.g., PT40H0M0S)")
    duration_format: Optional[int] = Field(default=7, description="Duration format: 7=days")
    work: Optional[str] = Field(default=None, description="Baseline work in ISO 8601 duration format")
    cost: Optional[float] = Field(default=None, description="Baseline cost")
    bcws: Optional[float] = Field(default=None, description="Budgeted Cost of Work Scheduled")
    bcwp: Optional[float] = Field(default=None, description="Budgeted Cost of Work Performed")
    fixed_cost: Optional[float] = Field(default=None, description="Baseline fixed cost")
    estimated_duration: Optional[bool] = Field(default=None, description="Whether duration is estimated")
    interim: Optional[bool] = Field(default=False, description="Whether this is an interim baseline")


class TaskBase(BaseModel):
    """Base task model with common fields"""
    name: str = Field(..., description="Task name")
    outline_number: str = Field(..., description="Task outline number (e.g., 1.2.3)")
    duration: Optional[str] = Field(default="PT8H0M0S", description="Duration in ISO 8601 format")
    value: Optional[str] = Field(default="", description="Custom field value")
    milestone: bool = Field(default=False, description="Whether this is a milestone")
    percent_complete: int = Field(default=0, ge=0, le=100, description="Percent complete (0-100)")
    predecessors: List[Predecessor] = Field(default_factory=list, description="List of predecessor tasks")
    # Task Constraints (MS Project compatible)
    # 0=As Soon As Possible, 1=As Late As Possible, 2=Must Start On, 3=Must Finish On,
    # 4=Start No Earlier Than, 5=Start No Later Than, 6=Finish No Earlier Than, 7=Finish No Later Than
    constraint_type: int = Field(default=0, ge=0, le=7, description="Task constraint type (0-7)")
    constraint_date: Optional[str] = Field(default=None, description="Constraint date in ISO 8601 format (required for types 2-7)")


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
    constraint_type: Optional[int] = Field(default=None, ge=0, le=7)
    constraint_date: Optional[str] = None


class Task(TaskBase):
    """Full task model with all fields"""
    id: str = Field(..., description="Unique task ID")
    uid: str = Field(..., description="Unique task UID")
    outline_level: int = Field(..., description="Outline level (depth in hierarchy)")
    start_date: Optional[str] = None
    finish_date: Optional[str] = None
    summary: bool = Field(default=False, description="Whether this is a summary task")
    # MS Project Baselines (up to 11 baselines: 0-10)
    baselines: List[TaskBaseline] = Field(default_factory=list, description="Task baselines for schedule tracking")


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
    project_id: Optional[str] = None  # Specific project this chat is for

class GenerateProjectRequest(BaseModel):
    """Request to generate a complete project from description"""
    description: str = Field(..., description="Natural language description of the project")
    project_type: str = Field(default="commercial", description="Type of project: residential, commercial, industrial, renovation")
    project_id: Optional[str] = None  # If provided, populate this specific project

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


# Calendar Models
class CalendarException(BaseModel):
    """Calendar exception (holiday or working day override)"""
    id: Optional[int] = None
    exception_date: str = Field(..., description="Exception date in YYYY-MM-DD format")
    name: str = Field(..., description="Name of the exception (e.g., 'Christmas Day')")
    is_working: bool = Field(default=False, description="True if this is a working day override, False for holiday")


class ProjectCalendar(BaseModel):
    """Project calendar configuration"""
    work_week: List[int] = Field(
        default=[1, 2, 3, 4, 5],
        description="Working days of week (1=Monday, 7=Sunday). Default: Mon-Fri"
    )
    hours_per_day: int = Field(default=8, ge=1, le=24, description="Working hours per day")
    exceptions: List[CalendarException] = Field(default_factory=list, description="List of holidays and exceptions")


class CalendarExceptionCreate(BaseModel):
    """Model for creating a calendar exception"""
    exception_date: str = Field(..., description="Exception date in YYYY-MM-DD format")
    name: str = Field(..., description="Name of the exception")
    is_working: bool = Field(default=False, description="True for working day override, False for holiday")


# Baseline Management Models
class SetBaselineRequest(BaseModel):
    """Request to set a project baseline"""
    baseline_number: int = Field(default=0, ge=0, le=10, description="Baseline number to set (0-10)")
    task_ids: Optional[List[str]] = Field(default=None, description="Specific task IDs to baseline. If None, all tasks are baselined.")


class ClearBaselineRequest(BaseModel):
    """Request to clear a project baseline"""
    baseline_number: int = Field(..., ge=0, le=10, description="Baseline number to clear (0-10)")
    task_ids: Optional[List[str]] = Field(default=None, description="Specific task IDs to clear. If None, all tasks are cleared.")


class BaselineInfo(BaseModel):
    """Information about a project baseline"""
    number: int = Field(..., description="Baseline number (0-10)")
    set_date: Optional[str] = Field(default=None, description="Date when baseline was set")
    task_count: int = Field(default=0, description="Number of tasks with this baseline")


class ProjectBaselinesResponse(BaseModel):
    """Response with all project baseline information"""
    baselines: List[BaselineInfo] = Field(default_factory=list, description="List of baselines in the project")
    total_tasks: int = Field(default=0, description="Total number of tasks in project")
