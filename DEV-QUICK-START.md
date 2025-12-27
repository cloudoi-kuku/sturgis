# 🚀 Developer Quick Start

## Daily Development - 3 Commands

### Terminal 1: Backend
```bash
cd backend
python main.py
```
**Runs at**: http://localhost:8000  
**API Docs**: http://localhost:8000/docs

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```
**Runs at**: http://localhost:5173

### Terminal 3: AI (Optional)
```bash
ollama serve
```
**Runs at**: http://localhost:11434  
**Note**: Only needed for AI features

---

## First Time Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```

### AI (Optional)
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from ollama.com

# Pull model
ollama pull llama3.2:3b
```

---

## Quick Commands

### Backend
```bash
# Start server
python main.py

# Install new package
pip install <package>
pip freeze > requirements.txt

# Check for errors
python -m py_compile main.py
```

### Frontend
```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Install new package
npm install <package>

# Check for errors
npm run lint
```

### AI
```bash
# Start Ollama
ollama serve

# List models
ollama list

# Test model
ollama run llama3.2:3b "Hello"

# Pull/update model
ollama pull llama3.2:3b
```

---

## URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5173 | Main UI |
| Backend | http://localhost:8000 | API |
| API Docs | http://localhost:8000/docs | Swagger UI |
| Ollama | http://localhost:11434 | AI Service |

---

## File Structure

```
backend/
├── main.py              # Main API server ⭐
├── ai_service.py        # AI integration
├── models.py            # Data models
├── xml_processor.py     # XML handling
└── validator.py         # Validation

frontend/src/
├── App.tsx              # Main app ⭐
├── components/          # UI components
│   ├── GanttChart.tsx
│   ├── TaskEditor.tsx
│   └── ...
└── api/client.ts        # API calls
```

---

## Common Tasks

### Add Backend Endpoint
1. Edit `backend/main.py`
2. Add function with `@app.get()` or `@app.post()`
3. Test at http://localhost:8000/docs

### Add Frontend Component
1. Create file in `frontend/src/components/`
2. Import in parent component
3. Use in JSX

### Add AI Feature
1. Edit `backend/ai_service.py` - add method
2. Edit `backend/main.py` - add endpoint
3. Edit `frontend/src/api/client.ts` - add API call
4. Create UI component

---

## Debugging

### Backend
- Check terminal for errors
- Add `print()` statements
- Use FastAPI docs: http://localhost:8000/docs

### Frontend
- Open DevTools (F12)
- Check Console tab
- Check Network tab for API calls

### AI
```bash
# Test Ollama
curl http://localhost:11434/api/tags

# Check backend can connect
curl http://localhost:8000/api/ai/health
```

---

## Git Workflow

```bash
# Check status
git status

# Stage changes
git add .

# Commit
git commit -m "feat: add new feature"

# Push
git push
```

---

## Testing Docker (When Ready)

```bash
# Build
docker-compose build

# Start
docker-compose up -d

# Logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## Troubleshooting

### Port Already in Use
```bash
# Find process using port (Mac/Linux)
lsof -i :8000
lsof -i :5173

# Kill process
kill -9 <PID>
```

### Module Not Found
```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### CORS Errors
- Backend CORS is configured for localhost:5173
- Check `backend/main.py` CORS settings

---

## 📚 Full Documentation

- **Development**: [DEVELOPMENT-WORKFLOW.md](DEVELOPMENT-WORKFLOW.md)
- **Docker**: [DOCKER-README.md](DOCKER-README.md)
- **AI**: [AI-SERVICE-README.md](AI-SERVICE-README.md)
- **Deployment**: [COMPLETE-DEPLOYMENT-GUIDE.md](COMPLETE-DEPLOYMENT-GUIDE.md)

---

**Happy Coding! 🎉**

