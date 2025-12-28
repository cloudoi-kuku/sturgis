# MS Project Configuration Tool - Web Edition

A modern web-based tool for configuring and managing Microsoft Project XML files with an interactive Gantt chart visualization.

## Features

- 🎯 **Interactive Gantt Chart** - Visual timeline with task dependencies
- ✅ **Real-time Validation** - Catch configuration errors before export
- 🔄 **Task Management** - Create, edit, and delete tasks with ease
- 📊 **Dependency Visualization** - See task relationships at a glance
- 🤖 **AI-Powered Features** - Local AI for task estimation, categorization, and optimization
- 🚀 **Modern Architecture** - React frontend + Python FastAPI backend + Ollama AI
- 💾 **XML Import/Export** - Seamless MS Project integration
- 🐳 **Fully Dockerized** - No external dependencies, runs anywhere

## Architecture

### Frontend (React + Vite + TypeScript)
- Interactive Gantt chart visualization
- Task editor with predecessor management
- Real-time validation feedback
- Modern, responsive UI

### Backend (Python + FastAPI)
- RESTful API for XML manipulation
- Comprehensive validation engine
- Task dependency management
- MS Project XML parsing and generation
- AI integration for intelligent features

### AI Service (Ollama + Llama 3.2)
- Local AI model (no cloud dependencies)
- Task duration estimation
- Automatic task categorization
- Dependency detection
- Project optimization suggestions
- Natural language chat interface

## Quick Start

### 🐳 Docker (Recommended - Works on All OS)

The easiest way to run the application with **full AI capabilities** on any operating system:

```bash
# Linux/Mac
./start.sh

# Windows
start.bat

# Or manually with Docker Compose
docker-compose up -d
```

Then open http://localhost in your browser.

**📖 Documentation:**
- **Complete Documentation**: [docs/](docs/) - All documentation organized by category
- **Quick Start**: [docs/guides/QUICKSTART.md](docs/guides/QUICKSTART.md)
- **Docker Setup**: [docs/deployment/DOCKER-README.md](docs/deployment/DOCKER-README.md)
- **AI Features**: [docs/features/](docs/features/) - All AI features documented

---

### 💻 Manual Setup (Development)

#### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn
- Ollama (for AI features)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Start the backend server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Usage

1. **Upload Project**: Click "Upload XML" and select your MS Project XML file
2. **View Tasks**: See all tasks in the interactive Gantt chart
3. **Edit Tasks**: Click on any task to edit its properties
4. **Add Tasks**: Click "New Task" to create additional tasks
5. **Manage Dependencies**: Add predecessors to define task relationships
6. **Validate**: Click "Validate" to check for configuration errors
7. **Export**: Click "Export XML" to download the modified project file

## Task Properties

- **Name**: Task description
- **Outline Number**: Hierarchical position (e.g., 1.2.3)
- **Duration**: ISO 8601 format (e.g., PT8H0M0S for 8 hours)
- **Milestone**: Mark as milestone (zero duration)
- **Custom Value**: Extended attribute value
- **Predecessors**: Task dependencies with type (FS, SS, FF, SF) and lag

## Dependency Types

Per MS Project XML Schema (mspdi_pj12.xsd):

0. **Finish-to-Finish (FF)**: Task B finishes when Task A finishes
1. **Finish-to-Start (FS)**: Task B starts when Task A finishes (DEFAULT)
2. **Start-to-Finish (SF)**: Task B finishes when Task A starts
3. **Start-to-Start (SS)**: Task B starts when Task A starts

## Validation

The tool validates:
- ✅ Required fields (name, outline number, dates)
- ✅ Outline number format and uniqueness
- ✅ Duration format (ISO 8601)
- ✅ Predecessor existence
- ✅ Circular dependency detection
- ✅ Milestone duration constraints

## API Documentation

Once the backend is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Project Structure

```
.
├── backend/
│   ├── main.py              # FastAPI application
│   ├── models.py            # Pydantic models
│   ├── xml_processor.py     # XML parsing and generation
│   ├── validator.py         # Validation logic
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts    # API client
│   │   ├── components/
│   │   │   ├── GanttChart.tsx
│   │   │   └── TaskEditor.tsx
│   │   ├── App.tsx          # Main application
│   │   └── App.css          # Styles
│   └── package.json         # Node dependencies
└── README.md
```

## Development

### Backend Development
```bash
cd backend
python main.py  # Auto-reloads on file changes
```

### Frontend Development
```bash
cd frontend
npm run dev  # Hot module replacement enabled
```

## Building for Production

### Frontend
```bash
cd frontend
npm run build
```

The production build will be in `frontend/dist/`

## Documentation

📚 **[Complete Documentation](docs/)** - All documentation organized by category:

- **[Features](docs/features/)** - Feature documentation and guides
- **[Guides](docs/guides/)** - Setup and usage guides
- **[Deployment](docs/deployment/)** - Deployment and configuration
- **[Architecture](docs/architecture/)** - Technical architecture
- **[Troubleshooting](docs/troubleshooting/)** - Problem solving

### Recent Updates (2025-12-27)
- ⭐ **Historical Learning** - AI learns from your past projects
- ⭐ **Chat Project Context** - Chat works with correct project
- ⭐ **Lag Validation** - Warns about suspicious lag values

See [docs/CHANGES_SUMMARY.md](docs/CHANGES_SUMMARY.md) for complete changelog.

## Troubleshooting

See [docs/troubleshooting/](docs/troubleshooting/) for comprehensive troubleshooting guides.

### Quick Fixes

**CORS Issues:**
- Ensure backend runs on port 8000
- Check `VITE_API_URL` in `frontend/.env`

**Validation Errors:**
- Check validation panel for details
- Ensure outline numbers are unique
- Verify predecessor tasks exist

**AI Not Working:**
- Install Ollama: `curl -fsSL https://ollama.com/install.sh | sh`
- Pull model: `ollama pull llama3.2:3b`
- See [docs/troubleshooting/AI_FEATURES_TROUBLESHOOTING.md](docs/troubleshooting/AI_FEATURES_TROUBLESHOOTING.md)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

