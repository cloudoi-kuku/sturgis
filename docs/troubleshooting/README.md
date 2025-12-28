# Troubleshooting Documentation

Solutions to common problems and issues.

## 🆘 General Troubleshooting

- **[Troubleshooting Guide](TROUBLESHOOTING.md)** - Common issues and solutions
  - Installation problems
  - Runtime errors
  - Configuration issues
  - Performance problems

- **[Server Status](SERVER_STATUS.md)** - Check server health
  - Backend status
  - Frontend status
  - Database status
  - AI service status

---

## 🤖 AI-Specific Troubleshooting

### AI Features
- **[AI Features Troubleshooting](AI_FEATURES_TROUBLESHOOTING.md)** - AI-specific issues
  - Ollama not responding
  - AI generating incorrect data
  - Chat not working
  - Model loading issues

- **[AI Features Diagnostic](AI_FEATURES_DIAGNOSTIC.md)** - Diagnose AI problems
  - Check Ollama installation
  - Verify model availability
  - Test AI endpoints
  - Debug AI responses

### AI UI Issues
- **[AI Chat Button Fix](AI_CHAT_BUTTON_FIX.md)** - Chat button not appearing
  - UI rendering issues
  - Component loading
  - State management

- **[AI UI Location](AI_UI_LOCATION.md)** - Find AI UI elements
  - Where is the chat button?
  - Where are AI features?
  - UI navigation

---

## 📊 Feature-Specific Troubleshooting

### Predecessor/Dependency Issues
- **[Predecessor Column Troubleshooting](PREDECESSOR_COLUMN_TROUBLESHOOTING.md)** - Dependency issues
  - Dependencies not showing
  - Invalid predecessor format
  - Circular dependencies
  - Lag calculation errors

- **[Predecessor Visual Guide](PREDECESSOR_VISUAL_GUIDE.md)** - Visual troubleshooting
  - Screenshots of correct setup
  - Common mistakes
  - Visual examples

---

## 🔧 Development Troubleshooting

- **[Fix Pylance Warnings](FIX_PYLANCE_WARNINGS.md)** - Python type warnings
  - Type hints
  - Import errors
  - Linting issues

---

## 🔍 Quick Diagnostics

### Is the Backend Running?
```bash
curl http://localhost:8000/docs
```
✅ Should return API documentation page

### Is the Frontend Running?
```bash
curl http://localhost:5173
```
✅ Should return HTML

### Is Ollama Running?
```bash
ollama list
```
✅ Should show installed models

### Is the Database Accessible?
```bash
ls -la backend/project_data/projects.db
```
✅ Should show database file

---

## 🐛 Common Issues & Solutions

### Issue: "Port already in use"
**Symptoms:** Backend or frontend won't start

**Solutions:**
```bash
# Find process using port 8000
lsof -i :8000
kill -9 <PID>

# Or use different port
# Backend: Edit main.py
# Frontend: Edit vite.config.ts
```

### Issue: "Ollama not found"
**Symptoms:** AI features not working

**Solutions:**
1. Install Ollama: `curl -fsSL https://ollama.com/install.sh | sh`
2. Pull model: `ollama pull llama3.2:3b`
3. Verify: `ollama list`

See [AI Features Troubleshooting](AI_FEATURES_TROUBLESHOOTING.md)

### Issue: "Database locked"
**Symptoms:** Can't save changes

**Solutions:**
1. Ensure only one backend instance running
2. Close any database browsers
3. Restart backend

### Issue: "CORS error"
**Symptoms:** Frontend can't connect to backend

**Solutions:**
1. Check CORS settings in `backend/main.py`
2. Verify frontend URL in allowed origins
3. Check browser console for exact error

### Issue: "Chat button not visible"
**Symptoms:** Can't find AI chat

**Solutions:**
See [AI Chat Button Fix](AI_CHAT_BUTTON_FIX.md) and [AI UI Location](AI_UI_LOCATION.md)

### Issue: "Predecessors not showing"
**Symptoms:** Dependencies not visible

**Solutions:**
See [Predecessor Column Troubleshooting](PREDECESSOR_COLUMN_TROUBLESHOOTING.md)

### Issue: "AI responses are slow"
**Symptoms:** Long wait times for AI

**Solutions:**
1. Check Ollama is running: `ollama list`
2. Use smaller model if needed
3. Check system resources
4. See [AI Features Diagnostic](AI_FEATURES_DIAGNOSTIC.md)

---

## 📋 Diagnostic Checklist

When troubleshooting, check:

### Environment
- [ ] Python 3.11+ installed
- [ ] Node.js 18+ installed
- [ ] Ollama installed and running
- [ ] Correct working directory

### Services
- [ ] Backend running on port 8000
- [ ] Frontend running on port 5173
- [ ] Ollama service active
- [ ] Database file exists

### Configuration
- [ ] Environment variables set
- [ ] CORS configured correctly
- [ ] API URLs correct
- [ ] Model downloaded

### Network
- [ ] Ports not blocked
- [ ] Firewall allows connections
- [ ] No proxy issues
- [ ] DNS resolving correctly

---

## 🔬 Advanced Diagnostics

### Enable Debug Logging
```python
# backend/main.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Check AI Service
```bash
cd backend
python -c "from ai_service import AIService; ai = AIService(); print(ai.test_connection())"
```

### Validate Database
```bash
cd backend
python -c "from database import DatabaseService; db = DatabaseService(); print(db.get_all_projects())"
```

### Test API Endpoints
```bash
# Test chat endpoint
curl -X POST http://localhost:8000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

---

## 📞 Getting Help

### Before Asking for Help
1. Check this troubleshooting guide
2. Review [Troubleshooting Guide](TROUBLESHOOTING.md)
3. Check [AI Features Diagnostic](AI_FEATURES_DIAGNOSTIC.md)
4. Review [Server Status](SERVER_STATUS.md)
5. Collect error messages and logs

### What to Include
- Error messages (full text)
- Steps to reproduce
- Environment details (OS, versions)
- Logs from backend/frontend
- What you've already tried

---

## 🔗 Related Documentation

- [Guides](../guides/) - Setup and usage guides
- [Deployment](../deployment/) - Deployment issues
- [Architecture](../architecture/) - Understand the system
- [Features](../features/) - Feature documentation

