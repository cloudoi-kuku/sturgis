# Architecture Documentation

Technical documentation about the system architecture and implementation details.

## 🏗️ System Architecture

### Overview
- **[Architecture Overview](ARCHITECTURE.md)** - Complete system architecture
  - Frontend architecture
  - Backend architecture
  - Database design
  - API design
  - Integration points

### Component Architecture
- **[AI Service](AI-SERVICE-README.md)** - AI service implementation
  - Ollama integration
  - LLM prompting strategies
  - Context management
  - Response parsing

- **[MS Project Compliance](MS_PROJECT_COMPLIANCE_SUMMARY.md)** - MS Project compatibility
  - XML format compliance
  - CPM algorithm
  - Task scheduling
  - Dependency handling

---

## 🤖 AI Architecture

### AI Service Design
The AI service uses a local LLM (Ollama with Llama 3.2:3b) for:
- Natural language understanding
- Project generation
- Task optimization
- Dependency detection

**Key Components:**
1. **Prompt Engineering** - Construction-specific prompts
2. **Context Management** - Project-aware responses
3. **Response Parsing** - Structured output extraction
4. **Historical Learning** - Pattern recognition from past projects

See [AI Service](AI-SERVICE-README.md) for details.

### AI Evolution
- **[AI Before/After](AI_BEFORE_AFTER.md)** - AI improvements over time
  - Initial implementation
  - Enhancements
  - Performance improvements
  - Accuracy gains

- **[Demo AI Integration](DEMO_AI_INTEGRATION.md)** - Integration examples
  - API integration
  - Chat integration
  - Command handling

---

## 📊 Data Architecture

### Database Design
```
projects/
├── id (UUID)
├── name
├── start_date
├── status_date
└── created_at

tasks/
├── id (UUID)
├── project_id (FK)
├── uid
├── name
├── outline_number
├── duration
├── start_date
├── finish_date
└── ...

predecessors/
├── id (UUID)
├── task_id (FK)
├── predecessor_outline_number
├── type
├── lag
└── lag_format
```

### Data Formats
- **[Lag Format Specification](LAG_FORMAT_SPECIFICATION.md)** - Lag format details
  - Format types (days, weeks, months, etc.)
  - Conversion rules
  - Validation rules
  - MS Project compatibility

---

## 🔌 API Architecture

### REST API Design
```
/api/project/*          - Project management
/api/tasks/*            - Task CRUD operations
/api/ai/*               - AI features
/api/validate           - Validation
/api/export             - Export to XML
/api/critical-path      - Critical path calculation
```

### API Patterns
- RESTful design
- JSON request/response
- Error handling
- Validation middleware

See [Architecture Overview](ARCHITECTURE.md) for API details.

---

## 🎨 Frontend Architecture

### Technology Stack
- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **TanStack Query** - Data fetching
- **Lucide React** - Icons
- **date-fns** - Date handling

### Component Structure
```
components/
├── GanttChart.tsx      - Gantt visualization
├── TaskEditor.tsx      - Task editing
├── AIChat.tsx          - AI chat interface
├── ProjectManager.tsx  - Project management
└── ...
```

### State Management
- React Query for server state
- Local state with useState
- Context for global state

---

## ⚙️ Backend Architecture

### Technology Stack
- **FastAPI** - Web framework
- **Python 3.11+** - Language
- **SQLite** - Database
- **Ollama** - Local LLM
- **Pydantic** - Data validation

### Service Layer
```
backend/
├── main.py              - API endpoints
├── ai_service.py        - AI logic
├── ai_command_handler.py - Command parsing
├── database.py          - Database operations
├── validator.py         - Validation logic
├── xml_processor.py     - XML import/export
└── models.py            - Data models
```

### Design Patterns
- Service layer pattern
- Repository pattern (database.py)
- Command pattern (ai_command_handler.py)
- Factory pattern (AI prompts)

---

## 🔄 Data Flow

### Project Import Flow
```
XML File → xml_processor.py → database.py → SQLite
                                          ↓
                                    API Response
                                          ↓
                                    Frontend Update
```

### AI Chat Flow
```
User Message → AIChat.tsx → /api/ai/chat → ai_command_handler.py
                                                    ↓
                                            ai_service.py (Ollama)
                                                    ↓
                                            database.py (Update)
                                                    ↓
                                            Response → Frontend
```

### Critical Path Calculation
```
Tasks → ai_service._calculate_critical_path()
            ↓
        CPM Algorithm (MS Project compatible)
            ↓
        Critical Tasks + Total Duration
```

---

## 📐 Design Decisions

### Why SQLite?
- Simple deployment
- No separate database server
- Good performance for single-user
- Easy backup (single file)

### Why Ollama?
- Local AI (privacy)
- No API costs
- Fast responses
- Offline capability

### Why FastAPI?
- Modern Python framework
- Automatic API docs
- Type validation
- Async support

### Why React + Vite?
- Fast development
- Hot module replacement
- Modern tooling
- Great DX

---

## 🔍 Implementation Status

- **[Implementation Complete](IMPLEMENTATION_COMPLETE.md)** - Feature completion status
  - Completed features
  - In-progress features
  - Planned features
  - Known limitations

---

## 🧪 Testing Architecture

### Test Structure
```
backend/
├── test_ai_commands.py
├── test_ai_populate.py
├── test_historical_learning.py
├── test_lag_validation.py
└── test_optimizer.py
```

### Testing Strategy
- Unit tests for services
- Integration tests for API
- Manual tests for UI
- AI response validation

---

## 🔗 Related Documentation

- [Features](../features/) - What features exist
- [Guides](../guides/) - How to use the system
- [Deployment](../deployment/) - How to deploy
- [Troubleshooting](../troubleshooting/) - Fix issues

