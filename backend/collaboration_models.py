from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    """User roles in a project"""
    OWNER = "owner"
    EDITOR = "editor" 
    REVIEWER = "reviewer"
    VIEWER = "viewer"


class ChangeType(str, Enum):
    """Types of changes that can be made to a project"""
    TASK_CREATED = "task_created"
    TASK_UPDATED = "task_updated"
    TASK_DELETED = "task_deleted"
    TASK_MOVED = "task_moved"
    METADATA_UPDATED = "metadata_updated"
    DEPENDENCY_ADDED = "dependency_added"
    DEPENDENCY_REMOVED = "dependency_removed"


class User(BaseModel):
    """User model for collaboration"""
    id: str = Field(..., description="Unique user ID")
    username: str = Field(..., description="Username", min_length=3, max_length=50)
    email: str = Field(..., description="User email address")
    display_name: str = Field(..., description="Display name for UI")
    avatar_url: Optional[str] = Field(default=None, description="User avatar URL")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active: Optional[datetime] = None


class ProjectMember(BaseModel):
    """Project membership model"""
    project_id: str = Field(..., description="Project ID")
    user_id: str = Field(..., description="User ID")
    role: UserRole = Field(..., description="User role in this project")
    invited_by: str = Field(..., description="User ID who invited this member")
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    last_active: Optional[datetime] = None


class ProjectShare(BaseModel):
    """Project sharing configuration"""
    project_id: str = Field(..., description="Project ID")
    share_token: str = Field(..., description="Unique share token for public access")
    is_public: bool = Field(default=False, description="Whether project is publicly accessible")
    default_role: UserRole = Field(default=UserRole.VIEWER, description="Default role for new members")
    expires_at: Optional[datetime] = Field(default=None, description="Share link expiration")
    created_by: str = Field(..., description="User ID who created the share")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Change(BaseModel):
    """Change tracking model for operational transforms"""
    id: str = Field(..., description="Unique change ID")
    project_id: str = Field(..., description="Project ID")
    user_id: str = Field(..., description="User who made the change")
    change_type: ChangeType = Field(..., description="Type of change")
    entity_id: Optional[str] = Field(default=None, description="ID of affected entity (task, etc.)")
    old_value: Optional[Dict[str, Any]] = Field(default=None, description="Previous value")
    new_value: Optional[Dict[str, Any]] = Field(default=None, description="New value")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    client_id: str = Field(..., description="Client session ID for conflict resolution")
    operation_id: str = Field(..., description="Unique operation ID for ordering")


class UserPresence(BaseModel):
    """Real-time user presence information"""
    user_id: str = Field(..., description="User ID")
    project_id: str = Field(..., description="Project ID")
    session_id: str = Field(..., description="Session/connection ID")
    is_active: bool = Field(default=True, description="Whether user is currently active")
    current_task_id: Optional[str] = Field(default=None, description="Currently selected task")
    current_field: Optional[str] = Field(default=None, description="Currently edited field")
    cursor_position: Optional[Dict[str, Any]] = Field(default=None, description="Cursor position data")
    last_seen: datetime = Field(default_factory=datetime.utcnow)


class Comment(BaseModel):
    """Comment model for reviews and discussions"""
    id: str = Field(..., description="Unique comment ID")
    project_id: str = Field(..., description="Project ID")
    task_id: Optional[str] = Field(default=None, description="Associated task ID")
    user_id: str = Field(..., description="Comment author")
    content: str = Field(..., description="Comment text", min_length=1, max_length=2000)
    parent_id: Optional[str] = Field(default=None, description="Parent comment for replies")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    is_resolved: bool = Field(default=False, description="Whether comment thread is resolved")


class ReviewRequest(BaseModel):
    """Review request for project changes"""
    id: str = Field(..., description="Unique review request ID")
    project_id: str = Field(..., description="Project ID")
    created_by: str = Field(..., description="User requesting review")
    assigned_to: List[str] = Field(..., description="Users assigned to review")
    title: str = Field(..., description="Review title")
    description: str = Field(..., description="Review description")
    changes_since: datetime = Field(..., description="Timestamp of changes to review")
    status: str = Field(default="pending", description="Review status: pending, approved, rejected")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class Notification(BaseModel):
    """Notification model"""
    id: str = Field(..., description="Unique notification ID")
    user_id: str = Field(..., description="Target user ID")
    project_id: Optional[str] = Field(default=None, description="Associated project")
    type: str = Field(..., description="Notification type")
    title: str = Field(..., description="Notification title")
    message: str = Field(..., description="Notification message")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Additional notification data")
    is_read: bool = Field(default=False, description="Whether notification is read")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None


# WebSocket Message Models

class WebSocketMessage(BaseModel):
    """Base WebSocket message"""
    type: str = Field(..., description="Message type")
    project_id: str = Field(..., description="Project ID")
    user_id: str = Field(..., description="User ID")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: Dict[str, Any] = Field(default_factory=dict, description="Message payload")


class PresenceUpdate(BaseModel):
    """Presence update message"""
    user_id: str
    username: str
    display_name: str
    is_active: bool
    current_task_id: Optional[str] = None
    current_field: Optional[str] = None
    cursor_position: Optional[Dict[str, Any]] = None


class ChangeNotification(BaseModel):
    """Change notification for real-time updates"""
    change_id: str
    change_type: ChangeType
    entity_id: Optional[str]
    user_id: str
    username: str
    old_value: Optional[Dict[str, Any]]
    new_value: Optional[Dict[str, Any]]
    timestamp: datetime


class ConflictResolution(BaseModel):
    """Conflict resolution data"""
    conflict_id: str = Field(..., description="Unique conflict ID")
    change_ids: List[str] = Field(..., description="Conflicting change IDs")
    resolution_strategy: str = Field(..., description="Resolution strategy: manual, auto-merge, last-write-wins")
    resolved_value: Optional[Dict[str, Any]] = Field(default=None, description="Resolved value")
    resolved_by: Optional[str] = Field(default=None, description="User who resolved conflict")
    resolved_at: Optional[datetime] = None


# Request/Response Models for API

class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    display_name: str
    password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    email: str
    password: str


class ShareProjectRequest(BaseModel):
    project_id: str
    role: UserRole = UserRole.VIEWER
    expires_in_hours: Optional[int] = Field(default=None, ge=1, le=8760)  # Max 1 year


class InviteUserRequest(BaseModel):
    project_id: str
    email: str
    role: UserRole = UserRole.VIEWER
    message: Optional[str] = None


class UpdatePermissionRequest(BaseModel):
    project_id: str
    user_id: str
    role: UserRole


class CreateCommentRequest(BaseModel):
    project_id: str
    task_id: Optional[str] = None
    content: str = Field(..., min_length=1, max_length=2000)
    parent_id: Optional[str] = None


class CreateReviewRequest(BaseModel):
    project_id: str
    assigned_to: List[str]
    title: str
    description: str


# Response Models

class UserResponse(BaseModel):
    """User response model (without sensitive data)"""
    id: str
    username: str
    email: str
    display_name: str
    avatar_url: Optional[str]
    created_at: datetime


class ProjectMemberResponse(BaseModel):
    """Project member with user details"""
    user: UserResponse
    role: UserRole
    joined_at: datetime
    last_active: Optional[datetime]


class PresenceResponse(BaseModel):
    """Current project presence"""
    active_users: List[PresenceUpdate]
    total_members: int


class NotificationResponse(BaseModel):
    """Notification response"""
    notifications: List[Notification]
    unread_count: int