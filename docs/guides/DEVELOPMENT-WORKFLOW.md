# 🛠️ Development Workflow

## Current Development Setup

We're continuing to develop using the **local development environment** and will test Docker deployment when the tool is feature-complete.

---

## 📋 Development Environment

### Backend (Python + FastAPI)

**Location**: `./backend/`

**Start Backend**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

**Backend runs at**: http://localhost:8000

**Hot Reload**: Enabled - changes auto-reload

### Frontend (React + Vite)

**Location**: `./frontend/`

**Start Frontend**:
```bash
cd frontend
npm install
npm run dev
```

**Frontend runs at**: http://localhost:5173

**Hot Reload**: Enabled - changes reflect immediately

### AI Service (Ollama)

**Local Ollama** (if you have it installed):
```bash
# Install Ollama (if not already)
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh
# Windows: Download from ollama.com

# Start Ollama
ollama serve

# Pull the model
ollama pull llama3.2:3b
```

**Ollama runs at**: http://localhost:11434

**Note**: AI features work if Ollama is running locally. If not, the app still works but AI features will be unavailable.

---

## 🔄 Development Workflow

### 1. Daily Development

```bash
# Terminal 1: Backend
cd backend
source venv/bin/activate
python main.py

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Ollama (optional, for AI features)
ollama serve
```

### 2. Making Changes

**Backend Changes**:
- Edit files in `backend/`
- Server auto-reloads
- Test at http://localhost:8000

**Frontend Changes**:
- Edit files in `frontend/src/`
- Vite auto-reloads
- Test at http://localhost:5173

**AI Changes**:
- Edit `backend/ai_service.py` or `backend/ai_command_handler.py`
- Backend auto-reloads
- Test AI endpoints

### 3. Testing Changes

**Manual Testing**:
- Use the web UI at http://localhost:5173
- Test API directly at http://localhost:8000/docs (FastAPI Swagger UI)

**Backend Tests** (when we add them):
```bash
cd backend
pytest
```

**Frontend Tests** (when we add them):
```bash
cd frontend
npm test
```

---

## 🐳 Docker Testing (When Ready)

When we're satisfied with the features and want to test the full Docker deployment:

### Quick Docker Test

```bash
# Build and start all services
docker-compose up -d

# Watch logs
docker-compose logs -f

# Test at http://localhost

# Stop when done
docker-compose down
```

### Full Docker Test

```bash
# Clean slate
docker-compose down -v

# Rebuild everything
docker-compose build --no-cache

# Start services
docker-compose up -d

# Monitor startup
docker-compose logs -f

# Verify health
curl http://localhost:8000/health
curl http://localhost:8000/api/ai/health

# Test application
# Open http://localhost in browser

# Stop and clean up
docker-compose down
```

---

## 📁 Project Structure

```
ms-project-tool/
├── backend/                    # Python FastAPI backend
│   ├── main.py                # Main API server
│   ├── ai_service.py          # AI integration
│   ├── ai_command_handler.py  # AI command processing
│   ├── models.py              # Pydantic models
│   ├── xml_processor.py       # XML handling
│   ├── validator.py           # Validation logic
│   ├── requirements.txt       # Python dependencies
│   ├── Dockerfile             # Backend Docker image
│   └── project_data/          # Persistent data (gitignored)
│
├── frontend/                   # React + Vite frontend
│   ├── src/                   # Source code
│   │   ├── components/        # React components
│   │   ├── api/              # API client
│   │   └── App.tsx           # Main app
│   ├── package.json          # Node dependencies
│   ├── Dockerfile            # Frontend Docker image
│   └── nginx.conf            # Nginx config for Docker
│
├── docker-compose.yml         # Development Docker config
├── docker-compose.prod.yml    # Production Docker config
├── .env.example              # Environment template
├── Makefile                  # Helper commands
│
└── Documentation/
    ├── README.md                        # Main readme
    ├── DEVELOPMENT-WORKFLOW.md          # This file
    ├── DOCKER-README.md                 # Docker guide
    ├── AI-SERVICE-README.md             # AI documentation
    ├── COMPLETE-DEPLOYMENT-GUIDE.md     # Deployment guide
    └── ...
```

---

## 🔧 Common Development Tasks

### Add a New Backend Endpoint

1. Edit `backend/main.py`
2. Add endpoint function
3. Test at http://localhost:8000/docs
4. Update frontend API client if needed

### Add a New Frontend Component

1. Create component in `frontend/src/components/`
2. Import and use in parent component
3. Test at http://localhost:5173

### Add a New AI Feature

1. Edit `backend/ai_service.py` - add AI logic
2. Edit `backend/main.py` - add API endpoint
3. Edit `frontend/src/api/client.ts` - add API call
4. Create UI component to use the feature

### Update Dependencies

**Backend**:
```bash
cd backend
pip install <package>
pip freeze > requirements.txt
```

**Frontend**:
```bash
cd frontend
npm install <package>
# package.json is auto-updated
```

---

## 🐛 Debugging

### Backend Debugging

**View Logs**:
- Backend prints to console
- Check terminal where `python main.py` is running

**Debug Mode**:
- FastAPI runs with `reload=True` by default
- Add `print()` statements for debugging
- Use Python debugger: `import pdb; pdb.set_trace()`

### Frontend Debugging

**Browser DevTools**:
- Open Chrome/Firefox DevTools (F12)
- Check Console for errors
- Check Network tab for API calls

**React DevTools**:
- Install React DevTools browser extension
- Inspect component state and props

### AI Debugging

**Check Ollama**:
```bash
# Test Ollama is running
curl http://localhost:11434/api/tags

# Check model is available
ollama list

# Test generation
ollama run llama3.2:3b "Hello"
```

**Backend AI Logs**:
- AI service logs to console
- Check backend terminal for AI-related errors

---

## 📝 Git Workflow

### Before Committing

```bash
# Check what changed
git status

# Review changes
git diff

# Stage changes
git add <files>

# Commit with descriptive message
git commit -m "feat: add task duration estimation UI"
```

### Commit Message Convention

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

---

## ✅ Pre-Docker Testing Checklist

Before testing Docker deployment, ensure:

- [ ] All features work in local development
- [ ] No console errors in browser
- [ ] No errors in backend logs
- [ ] AI features work (if Ollama is running)
- [ ] Can upload/export XML files
- [ ] Can create/edit/delete tasks
- [ ] Validation works correctly
- [ ] Data persists across backend restarts
- [ ] Frontend builds successfully: `npm run build`
- [ ] Backend has no import errors

---

## 🚀 When Ready for Docker Testing

1. **Commit all changes**:
   ```bash
   git add .
   git commit -m "feat: ready for Docker testing"
   ```

2. **Test Docker build**:
   ```bash
   docker-compose build
   ```

3. **Test Docker run**:
   ```bash
   docker-compose up -d
   docker-compose logs -f
   ```

4. **Verify everything works**:
   - Frontend: http://localhost
   - Backend: http://localhost:8000
   - AI: http://localhost:8000/api/ai/health

5. **If issues found**:
   - Fix in local development
   - Test locally
   - Rebuild Docker images
   - Test again

---

## 💡 Tips

### Speed Up Development

- Keep both backend and frontend running
- Use browser auto-refresh
- Use FastAPI's `/docs` for API testing
- Use React DevTools for component debugging

### Avoid Common Issues

- **Port conflicts**: Make sure ports 8000, 5173, 11434 are free
- **CORS errors**: Backend CORS is configured for localhost:5173
- **Module not found**: Run `pip install -r requirements.txt` or `npm install`
- **Ollama not found**: AI features require Ollama running locally

### Keep Docker Ready

- Don't commit large files to git
- Keep `.dockerignore` updated
- Test Docker build occasionally
- Keep documentation updated

---

## 📞 Current Development Status

**Mode**: Local Development  
**Backend**: http://localhost:8000  
**Frontend**: http://localhost:5173  
**AI**: http://localhost:11434 (optional)  

**Docker**: Ready for testing when features are complete  

---

**Happy Coding! 🚀**

