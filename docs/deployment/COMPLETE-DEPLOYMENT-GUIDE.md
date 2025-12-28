# 🚀 Complete Deployment Guide - Project Configuration Tool

## 📋 Table of Contents

1. [Overview](#overview)
2. [What's Included](#whats-included)
3. [Quick Start](#quick-start)
4. [System Requirements](#system-requirements)
5. [First-Time Setup](#first-time-setup)
6. [Verification](#verification)
7. [Documentation Index](#documentation-index)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The Project Configuration Tool is a **fully self-contained, AI-powered web application** for managing Microsoft Project XML files. Everything runs in Docker containers with **zero external dependencies**.

### Key Features

✅ **100% Self-Contained** - No cloud services, API keys, or external dependencies  
✅ **AI-Powered** - Local Llama 3.2 AI for intelligent task management  
✅ **Cross-Platform** - Works on Windows, macOS, and Linux  
✅ **Privacy-First** - All data and AI processing stays on your machine  
✅ **Production-Ready** - Fully dockerized with health checks and monitoring  

---

## What's Included

### Services (3 Docker Containers)

1. **Frontend** (Nginx + React)
   - Modern web interface
   - Interactive Gantt chart
   - Real-time validation
   - Port: 80

2. **Backend** (FastAPI + Python)
   - RESTful API
   - XML processing
   - Task management
   - Port: 8000

3. **Ollama AI** (Llama 3.2)
   - Local AI inference
   - Task estimation
   - Categorization
   - Chat interface
   - Port: 11434

### Storage (2 Volumes)

1. **project-data** - Your project files and XML data
2. **ollama-data** - AI models (~2GB)

### Total Size

- **First Download**: ~3.7GB (includes AI model)
- **Disk Usage**: ~5GB (with project data)
- **RAM Required**: 4-8GB
- **CPU**: 2+ cores (4+ recommended for AI)

---

## Quick Start

### Step 1: Install Docker

**Windows/Mac**: Download [Docker Desktop](https://www.docker.com/products/docker-desktop/)  
**Linux**: Run `curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh`

Verify installation:
```bash
docker --version
docker-compose --version
```

### Step 2: Start the Application

**Linux/Mac**:
```bash
./start.sh
```

**Windows**:
```bash
start.bat
```

**Manual**:
```bash
docker-compose up -d
```

### Step 3: Wait for AI Model Download

**First startup only**: The AI model (~2GB) will download automatically. This takes 5-10 minutes depending on your internet speed.

Watch progress:
```bash
docker-compose logs -f ollama
```

### Step 4: Access the Application

Open your browser to: **http://localhost**

---

## System Requirements

### Minimum

| Component | Requirement |
|-----------|-------------|
| **OS** | Windows 10+, macOS 10.15+, Linux (any modern distro) |
| **RAM** | 4GB |
| **Disk** | 5GB free space |
| **CPU** | 2 cores |
| **Internet** | Required for initial setup only |

### Recommended

| Component | Requirement |
|-----------|-------------|
| **RAM** | 8GB |
| **Disk** | 10GB free space |
| **CPU** | 4+ cores |
| **Internet** | 10+ Mbps for faster model download |

---

## First-Time Setup

### 1. Clone/Download the Project

```bash
git clone <repository-url>
cd ms-project-tool
```

### 2. (Optional) Configure Environment

```bash
cp .env.example .env
# Edit .env if you want to customize settings
```

Default settings work for most users.

### 3. Start Services

```bash
# Linux/Mac
./start.sh

# Windows
start.bat
```

### 4. Monitor Startup

```bash
# Watch all logs
docker-compose logs -f

# Watch specific service
docker-compose logs -f ollama    # AI model download
docker-compose logs -f backend   # Backend startup
docker-compose logs -f frontend  # Frontend startup
```

### 5. Verify Services

```bash
# Check all services are running
docker-compose ps

# Should show:
# msproject-ollama     Up (healthy)
# msproject-backend    Up (healthy)
# msproject-frontend   Up (healthy)
```

---

## Verification

### Health Checks

```bash
# Backend health
curl http://localhost:8000/health

# Expected: {"status":"healthy","service":"MS Project Configuration API",...}

# AI health
curl http://localhost:8000/api/ai/health

# Expected: {"status":"healthy","model":"llama3.2:3b","available":true}
```

### Functional Tests

1. ✅ Open http://localhost in browser
2. ✅ Upload a test MS Project XML file
3. ✅ View tasks in Gantt chart
4. ✅ Create a new task
5. ✅ Edit an existing task
6. ✅ Try AI features (estimate duration, categorize)
7. ✅ Export XML file
8. ✅ Restart and verify data persists

### AI Verification

```bash
# Check AI model is downloaded
make ollama-status

# Or manually
docker-compose exec ollama ollama list

# Expected output:
# NAME              ID              SIZE      MODIFIED
# llama3.2:3b       a80c4f17acd5    2.0 GB    X minutes ago
```

---

## Documentation Index

### Getting Started
- **[README.md](README.md)** - Project overview and quick start
- **[DOCKER-README.md](DOCKER-README.md)** - Comprehensive Docker guide
- **[DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md)** - Step-by-step deployment checklist

### AI Features
- **[AI-SERVICE-README.md](AI-SERVICE-README.md)** - AI service documentation
- **[OLLAMA-INTEGRATION-SUMMARY.md](OLLAMA-INTEGRATION-SUMMARY.md)** - Ollama integration details

### Reference
- **[DOCKER-DEPLOYMENT-SUMMARY.md](DOCKER-DEPLOYMENT-SUMMARY.md)** - Architecture and deployment summary
- **[DOCKER-QUICK-REFERENCE.md](DOCKER-QUICK-REFERENCE.md)** - Quick command reference
- **[Makefile](Makefile)** - Available make commands

---

## Troubleshooting

### Services Won't Start

```bash
# Check Docker is running
docker info

# View logs
docker-compose logs

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Port Conflicts

If ports 80, 8000, or 11434 are in use:

```bash
# Find what's using the port (Linux/Mac)
sudo lsof -i :80

# Find what's using the port (Windows)
netstat -ano | findstr :80

# Solution: Edit docker-compose.yml to use different ports
```

### AI Model Not Downloading

```bash
# Check Ollama logs
docker-compose logs ollama

# Manually pull model
docker-compose exec ollama ollama pull llama3.2:3b

# Check disk space
df -h  # Linux/Mac
```

### Slow AI Responses

1. **Increase Docker resources** in Docker Desktop settings
2. **Use smaller model**: `ollama pull llama3.2:1b`
3. **Upgrade CPU**: AI inference is CPU-intensive

### Data Not Persisting

```bash
# Check volumes
docker volume ls

# Should see:
# code_ollama-data
# code_project-data

# Backup data
make backup
```

---

## Common Commands

### Start/Stop

```bash
make start          # Build and start
make up             # Start services
make down           # Stop services
make restart        # Restart services
```

### Logs

```bash
make logs           # View all logs
make logs-backend   # Backend logs only
make logs-frontend  # Frontend logs only
make ollama-logs    # AI logs only
```

### Maintenance

```bash
make backup         # Backup project data
make clean          # Remove containers and volumes
make health         # Check service health
make status         # Check service status
```

### AI Commands

```bash
make ollama-status  # Check AI model status
make ollama-pull    # Update AI model
make shell-ollama   # Access Ollama container
```

---

## Production Deployment

For production use:

```bash
# Use production configuration
docker-compose -f docker-compose.prod.yml up -d

# Features:
# - Resource limits
# - Log rotation
# - Always restart policy
# - No source code mounts
```

See [DOCKER-README.md](DOCKER-README.md) for production deployment details.

---

## Support

### Check Logs First

```bash
docker-compose logs -f
```

### Health Checks

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/ai/health
```

### Get Help

1. Check [DOCKER-README.md](DOCKER-README.md) troubleshooting section
2. Check [AI-SERVICE-README.md](AI-SERVICE-README.md) for AI issues
3. Review logs: `docker-compose logs`
4. Verify checklist: [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md)

---

## Next Steps

After successful deployment:

1. **Upload your first project** - Import an MS Project XML file
2. **Try AI features** - Estimate task durations, categorize tasks
3. **Explore the chat** - Ask the AI about your project
4. **Set up backups** - Run `make backup` regularly
5. **Read the docs** - Explore all features in the documentation

---

## 🎉 You're All Set!

Your Project Configuration Tool is now running with full AI capabilities!

**Access**: http://localhost  
**API**: http://localhost:8000  
**AI**: Fully integrated and ready to use  

**Enjoy AI-powered project management!** 🚀

