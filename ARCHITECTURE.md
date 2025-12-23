# Architecture Documentation - MS Project Configuration Tool

## System Overview

The MS Project Configuration Tool is a modern web-based application that allows users to visually edit Microsoft Project XML files through an interactive Gantt chart interface.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React + TypeScript + Vite                           │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │   Gantt    │  │    Task    │  │    API     │     │   │
│  │  │   Chart    │  │   Editor   │  │   Client   │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  │         │               │               │            │   │
│  │         └───────────────┴───────────────┘            │   │
│  │                         │                            │   │
│  │                  React Query                         │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────┬───────────────────────────────────┘
                           │ HTTP/REST API
                           │ (JSON)
┌──────────────────────────┴───────────────────────────────────┐
│                         Backend                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  FastAPI + Python                                    │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │  │    API     │  │    XML     │  │ Validator  │     │   │
│  │  │  Endpoints │  │ Processor  │  │            │     │   │
│  │  └────────────┘  └────────────┘  └────────────┘     │   │
│  │         │               │               │            │   │
│  │         └───────────────┴───────────────┘            │   │
│  │                         │                            │   │
│  │                  Pydantic Models                     │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **React 19.2.3** - UI framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **@tanstack/react-query** - Data fetching and state management
- **Axios** - HTTP client
- **date-fns** - Date manipulation
- **lucide-react** - Icon library
- **@dnd-kit** - Drag and drop functionality

### Backend
- **FastAPI 0.115.6** - Modern Python web framework
- **Uvicorn** - ASGI server
- **Pydantic 2.10.5** - Data validation
- **lxml 5.3.0** - XML parsing and generation
- **python-dateutil** - Date handling

## Component Architecture

### Frontend Components

#### 1. App.tsx (Main Application)
- **Purpose:** Root component, orchestrates the entire application
- **Responsibilities:**
  - Manages global state with React Query
  - Handles file upload
  - Coordinates task CRUD operations
  - Manages validation and export
- **Key Features:**
  - QueryClient provider setup
  - API mutation handlers
  - Error handling and user feedback

#### 2. GanttChart.tsx
- **Purpose:** Visual representation of project timeline
- **Responsibilities:**
  - Renders task list and timeline
  - Calculates task positions based on dates
  - Handles task selection
  - Displays task dependencies visually
- **Key Features:**
  - Dynamic timeline scaling
  - Task bar rendering with duration
  - Milestone visualization (diamond shape)
  - Summary task highlighting
  - Expandable/collapsible task hierarchy

#### 3. TaskEditor.tsx
- **Purpose:** Modal form for creating/editing tasks
- **Responsibilities:**
  - Task property editing
  - Predecessor management
  - Form validation
  - Data submission
- **Key Features:**
  - Dynamic predecessor addition/removal
  - Dependency type selection (FS, SS, FF, SF)
  - Lag time configuration
  - Real-time form updates

#### 4. API Client (client.ts)
- **Purpose:** Centralized API communication
- **Responsibilities:**
  - HTTP request handling
  - Type-safe API calls
  - Error handling
  - Response transformation
- **Key Features:**
  - TypeScript interfaces for all data types
  - Axios instance configuration
  - Blob handling for file downloads

### Backend Components

#### 1. main.py (FastAPI Application)
- **Purpose:** API server and endpoint definitions
- **Endpoints:**
  - `POST /api/project/upload` - Upload and parse XML
  - `GET /api/project/metadata` - Get project metadata
  - `PUT /api/project/metadata` - Update project metadata
  - `GET /api/tasks` - List all tasks
  - `POST /api/tasks` - Create new task
  - `PUT /api/tasks/{task_id}` - Update task
  - `DELETE /api/tasks/{task_id}` - Delete task
  - `POST /api/validate` - Validate project
  - `POST /api/export` - Export XML
- **Features:**
  - CORS middleware
  - In-memory project storage
  - Error handling
  - Auto-generated API documentation

#### 2. xml_processor.py (MSProjectXMLProcessor)
- **Purpose:** XML parsing and generation
- **Key Methods:**
  - `parse_xml()` - Extract project data from XML
  - `add_task()` - Insert new task with ID reordering
  - `update_task()` - Modify existing task
  - `delete_task()` - Remove task and reorder
  - `generate_xml()` - Create MS Project XML from data
- **Features:**
  - Namespace handling
  - Task ID/UID management
  - Outline number hierarchy
  - Predecessor link management
  - ISO 8601 duration handling

#### 3. validator.py
- **Purpose:** Project and task validation
- **Validation Rules:**
  - Required fields (name, outline_number, dates)
  - Outline number format (regex: `^\d+(\.\d+)*$`)
  - Outline number uniqueness
  - Duration format (ISO 8601: `PT\d+H\d+M\d+S`)
  - Predecessor existence
  - Circular dependency detection (DFS algorithm)
  - Milestone duration constraints
- **Features:**
  - Comprehensive error messages
  - Task-level and project-level validation
  - Dependency graph analysis

#### 4. models.py (Pydantic Models)
- **Purpose:** Data validation and serialization
- **Models:**
  - `Predecessor` - Task dependency
  - `TaskBase/TaskCreate/TaskUpdate/Task` - Task data
  - `ProjectMetadata` - Project information
  - `ValidationError/ValidationResult` - Validation responses
- **Features:**
  - Type validation
  - Optional field handling
  - Automatic JSON serialization

## Data Flow

### 1. Upload Workflow
```
User selects file → Frontend uploads → Backend parses XML → 
Extracts tasks and metadata → Stores in memory → 
Returns data to frontend → Frontend displays in Gantt chart
```

### 2. Task Edit Workflow
```
User clicks task → TaskEditor opens with data → 
User modifies fields → Submits form → 
Frontend sends PUT request → Backend updates task → 
Reorders IDs if needed → Returns updated task → 
Frontend invalidates cache → React Query refetches → 
Gantt chart updates
```

### 3. Validation Workflow
```
User clicks Validate → Frontend sends POST request → 
Backend runs all validation rules → 
Checks structure, format, dependencies → 
Returns validation result → Frontend displays errors → 
User fixes issues → Re-validates
```

### 4. Export Workflow
```
User clicks Export → Frontend validates first → 
If valid, sends POST request → Backend generates XML → 
Creates complete MS Project XML structure → 
Returns as blob → Frontend triggers download → 
User imports into MS Project
```

## State Management

### Frontend State
- **React Query Cache:**
  - Tasks list
  - Project metadata
  - Automatic refetching on mutations
  - Optimistic updates

- **Local Component State:**
  - Selected task
  - Modal open/close
  - Validation errors
  - Form data

### Backend State
- **In-Memory Storage:**
  - Current project data (global variable)
  - Temporary storage between operations
  - Cleared on server restart

**Note:** For production, consider:
- Database for persistent storage
- Session management
- Multi-user support

## Security Considerations

### Current Implementation
- CORS enabled for localhost development
- File type validation (XML only)
- Input validation via Pydantic

### Production Recommendations
- Add authentication (JWT)
- Implement rate limiting
- Add file size limits
- Sanitize XML input
- Use HTTPS
- Implement CSRF protection
- Add user session management

## Performance Considerations

### Frontend Optimizations
- React Query caching reduces API calls
- Memoization in Gantt chart calculations
- Lazy loading for large task lists
- Debounced search/filter (future)

### Backend Optimizations
- Efficient XML parsing with lxml
- In-memory operations (fast but not scalable)
- Async/await for I/O operations
- Streaming for large file exports (future)

## Scalability

### Current Limitations
- Single server instance
- In-memory storage (not persistent)
- No concurrent user support
- Limited to file size that fits in memory

### Scaling Strategies
1. **Database Integration:**
   - PostgreSQL for project storage
   - Redis for caching
   - File storage (S3, Azure Blob)

2. **Horizontal Scaling:**
   - Load balancer
   - Multiple backend instances
   - Shared database

3. **Microservices (Future):**
   - Separate XML processing service
   - Validation service
   - File storage service

## Error Handling

### Frontend
- Try-catch blocks for API calls
- User-friendly error messages
- Validation feedback
- Loading states

### Backend
- HTTPException for API errors
- Detailed error messages
- Logging (future enhancement)
- Graceful degradation

## Testing Strategy

### Frontend Testing (Recommended)
- Unit tests: Jest + React Testing Library
- Component tests: Test user interactions
- Integration tests: Test API integration
- E2E tests: Cypress or Playwright

### Backend Testing (Recommended)
- Unit tests: pytest
- API tests: TestClient from FastAPI
- Validation tests: Test all validation rules
- XML parsing tests: Test with various XML files

## Future Enhancements

1. **Database Integration**
2. **User Authentication**
3. **Real-time Collaboration**
4. **Undo/Redo Functionality**
5. **Advanced Gantt Features** (zoom, pan, drag tasks)
6. **Resource Management**
7. **Critical Path Analysis**
8. **Export to Multiple Formats** (PDF, Excel)
9. **Template Library**
10. **Mobile Responsive Design**

