# 🤖 AI Service Documentation

## Overview

The MS Project Configuration Tool includes a **fully integrated local AI service** powered by Ollama and Llama 3.2. This provides intelligent features without requiring any cloud API keys or external dependencies.

---

## 🎯 Features

### 1. Task Duration Estimation
- Automatically estimates realistic task durations based on task name and type
- Considers construction project context and industry standards
- Provides confidence scores and reasoning

### 2. Task Categorization
- Automatically categorizes tasks into construction phases
- Categories: Foundation, Framing, MEP, Finishes, Site Work, etc.
- Helps organize large projects

### 3. Dependency Detection
- Analyzes task relationships and suggests dependencies
- Identifies which tasks should come before others
- Recommends appropriate dependency types (Finish-to-Start, etc.)

### 4. Project Optimization
- Analyzes critical path and suggests optimizations
- Recommends ways to reduce project duration
- Provides multiple optimization strategies

### 5. Natural Language Chat
- Ask questions about your project
- Get AI-powered insights and recommendations
- Context-aware responses based on your project data

---

## 🏗️ Architecture

### Components

```
┌─────────────────────────────────────┐
│  Frontend (React)                   │
│  - AI Chat Interface                │
│  - Task Estimation UI               │
│  - Optimization Dashboard           │
└──────────────┬──────────────────────┘
               │
               │ HTTP/REST
               ▼
┌─────────────────────────────────────┐
│  Backend (FastAPI)                  │
│  - ai_service.py                    │
│  - ai_command_handler.py            │
│  - API endpoints                    │
└──────────────┬──────────────────────┘
               │
               │ HTTP (port 11434)
               ▼
┌─────────────────────────────────────┐
│  Ollama Container                   │
│  - Llama 3.2 (3B parameters)        │
│  - Local inference                  │
│  - No internet required             │
└─────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Docker Setup (Automatic)

When you start the application with Docker, Ollama is automatically configured:

```bash
docker-compose up -d
```

**First startup**: Downloads the AI model (~2GB). Takes 5-10 minutes.  
**Subsequent starts**: Uses cached model. Takes seconds.

### Verify AI Service

```bash
# Check Ollama status
make ollama-status

# Or manually
docker-compose exec ollama ollama list
```

Expected output:
```
NAME              ID              SIZE      MODIFIED
llama3.2:3b       a80c4f17acd5    2.0 GB    X minutes ago
```

---

## 📡 API Endpoints

### Health Check
```http
GET /api/ai/health
```

Response:
```json
{
  "status": "healthy",
  "model": "llama3.2:3b",
  "available": true
}
```

### Estimate Task Duration
```http
POST /api/ai/estimate-duration
Content-Type: application/json

{
  "task_name": "Pour foundation concrete",
  "task_type": "construction",
  "project_context": { ... }
}
```

Response:
```json
{
  "days": 3,
  "confidence": 85,
  "reasoning": "Foundation concrete typically requires 1 day for prep, 1 day for pour, and 1 day for initial curing before proceeding."
}
```

### Categorize Task
```http
POST /api/ai/categorize-task
Content-Type: application/json

{
  "task_name": "Install electrical panels",
  "project_context": { ... }
}
```

Response:
```json
{
  "category": "MEP (Mechanical, Electrical, Plumbing)",
  "confidence": 90,
  "reasoning": "Electrical panel installation is a core electrical system task."
}
```

### Detect Dependencies
```http
POST /api/ai/detect-dependencies
Content-Type: application/json

{
  "task_name": "Install drywall",
  "all_tasks": ["Frame walls", "Install electrical", "Install plumbing", ...]
}
```

Response:
```json
{
  "dependencies": [
    {
      "task": "Frame walls",
      "type": "Finish-to-Start",
      "reasoning": "Walls must be framed before drywall can be installed"
    },
    {
      "task": "Install electrical",
      "type": "Finish-to-Start",
      "reasoning": "Electrical rough-in must be complete before drywall"
    }
  ]
}
```

### Chat with AI
```http
POST /api/ai/chat
Content-Type: application/json

{
  "message": "How can I reduce the project duration?",
  "project_context": { ... }
}
```

Response:
```json
{
  "response": "Based on your project, here are some ways to reduce duration:\n1. Parallelize independent tasks...\n2. Add resources to critical path tasks...\n3. Consider fast-tracking certain phases...",
  "context_used": true
}
```

---

## 🔧 Configuration

### Environment Variables

```env
# Ollama Base URL (Docker service name)
OLLAMA_BASE_URL=http://ollama:11434

# Model to use
OLLAMA_MODEL=llama3.2:3b
```

### Change AI Model

To use a different model:

```bash
# Pull a different model
docker-compose exec ollama ollama pull llama3.2:1b  # Smaller, faster
docker-compose exec ollama ollama pull llama3.2:7b  # Larger, more accurate

# Update .env file
OLLAMA_MODEL=llama3.2:7b

# Restart backend
docker-compose restart backend
```

---

## 📊 Model Information

### Llama 3.2 (3B)

- **Parameters**: 3 billion
- **Size**: ~2GB
- **Speed**: Fast inference on CPU
- **Quality**: Good for task estimation and categorization
- **Context Window**: 8K tokens
- **Quantization**: Q4_0 (optimized for size/speed)

### Performance

- **Task Estimation**: ~2-5 seconds
- **Categorization**: ~1-3 seconds
- **Dependency Detection**: ~3-7 seconds
- **Chat Response**: ~3-10 seconds

*Times vary based on CPU performance*

---

## 🐛 Troubleshooting

### AI Service Not Available

```bash
# Check Ollama container status
docker-compose ps ollama

# Check Ollama logs
docker-compose logs ollama

# Restart Ollama
docker-compose restart ollama
```

### Model Not Downloaded

```bash
# Manually pull the model
docker-compose exec ollama ollama pull llama3.2:3b

# Check available models
docker-compose exec ollama ollama list
```

### Slow Responses

- **CPU**: Ollama uses CPU for inference. More cores = faster.
- **RAM**: Ensure at least 4GB available for Ollama.
- **Model Size**: Try a smaller model (1B) for faster responses.

### Connection Errors

```bash
# Test Ollama connectivity from backend
docker-compose exec backend curl http://ollama:11434/api/tags

# Should return JSON with model list
```

---

## 🔒 Privacy & Security

### Fully Local
- ✅ All AI processing happens locally
- ✅ No data sent to external servers
- ✅ No API keys required
- ✅ Works offline (after initial model download)

### Data Privacy
- Your project data never leaves your machine
- AI model runs in isolated Docker container
- No telemetry or tracking

---

## 🎓 Best Practices

### 1. Provide Context
Give the AI more context for better results:
```json
{
  "task_name": "Install HVAC system",
  "project_context": {
    "project_type": "Commercial Office Building",
    "building_size": "50,000 sq ft",
    "similar_tasks": [...]
  }
}
```

### 2. Review AI Suggestions
- AI provides suggestions, not absolute truth
- Always review and adjust estimates
- Use AI as a starting point, not final answer

### 3. Iterative Refinement
- Use chat to ask follow-up questions
- Refine estimates based on project specifics
- Combine AI suggestions with expert knowledge

---

## 📈 Future Enhancements

Planned features:
- [ ] Risk assessment and mitigation suggestions
- [ ] Resource allocation optimization
- [ ] Cost estimation
- [ ] Schedule conflict detection
- [ ] Multi-language support
- [ ] Custom model fine-tuning

---

## 🆘 Support

### Check AI Health
```bash
curl http://localhost:8000/api/ai/health
```

### View AI Logs
```bash
make ollama-logs
```

### Reset AI Service
```bash
docker-compose down
docker volume rm code_ollama-data
docker-compose up -d
```

---

## 📚 Additional Resources

- [Ollama Documentation](https://ollama.ai/docs)
- [Llama 3.2 Model Card](https://ollama.ai/library/llama3.2)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

---

**✨ Enjoy AI-powered project management!**

