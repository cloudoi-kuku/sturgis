# Deployment Documentation

Guides for deploying the Construction Project Management System to production.

## 📋 Deployment Guides

### Main Deployment Documentation
- **[Deployment Guide](DEPLOYMENT.md)** - Standard deployment process
- **[Complete Deployment Guide](COMPLETE-DEPLOYMENT-GUIDE.md)** - Comprehensive deployment guide
- **[Deployment Checklist](DEPLOYMENT-CHECKLIST.md)** - Pre-deployment checklist

### Docker Deployment
- **[Docker Deployment Summary](DOCKER-DEPLOYMENT-SUMMARY.md)** - Docker setup overview
- **[Docker Quick Reference](DOCKER-QUICK-REFERENCE.md)** - Common Docker commands
- **[Docker README](DOCKER-README.md)** - Detailed Docker documentation

### Component-Specific Deployment
- **[Ollama Integration](OLLAMA-INTEGRATION-SUMMARY.md)** - Deploy local AI (Ollama)
- **[SQLite Migration](SQLITE_MIGRATION_SUMMARY.md)** - Database migration guide
- **[Database Migration](DATABASE_MIGRATION.md)** - Detailed migration steps

---

## 🚀 Quick Deployment Paths

### Option 1: Docker (Recommended)
```bash
# 1. Clone repository
git clone <repo-url>
cd code

# 2. Build and run with Docker
docker-compose up -d

# 3. Access application
# Frontend: http://localhost:5173
# Backend: http://localhost:8000
```

**Documentation:**
1. [Docker Deployment Summary](DOCKER-DEPLOYMENT-SUMMARY.md)
2. [Docker Quick Reference](DOCKER-QUICK-REFERENCE.md)

### Option 2: Manual Deployment
```bash
# 1. Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python main.py

# 2. Frontend setup (new terminal)
cd frontend
npm install
npm run dev
```

**Documentation:**
1. [Deployment Guide](DEPLOYMENT.md)
2. [Complete Deployment Guide](COMPLETE-DEPLOYMENT-GUIDE.md)

### Option 3: Production Deployment
Follow the complete checklist for production-ready deployment.

**Documentation:**
1. [Deployment Checklist](DEPLOYMENT-CHECKLIST.md)
2. [Complete Deployment Guide](COMPLETE-DEPLOYMENT-GUIDE.md)

---

## 🔧 Component Deployment

### Backend Deployment
- Python 3.11+
- FastAPI server
- SQLite database
- See [Deployment Guide](DEPLOYMENT.md)

### Frontend Deployment
- Node.js 18+
- React + Vite
- Nginx (production)
- See [Docker README](DOCKER-README.md)

### AI Service Deployment
- Ollama (local AI)
- Llama 3.2:3b model
- See [Ollama Integration](OLLAMA-INTEGRATION-SUMMARY.md)

### Database Deployment
- SQLite (default)
- Migration scripts
- See [Database Migration](DATABASE_MIGRATION.md)

---

## 📊 Deployment Environments

### Development
```bash
# Backend
cd backend && python main.py

# Frontend
cd frontend && npm run dev
```

### Staging
```bash
docker-compose -f docker-compose.yml up -d
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

See [Docker Deployment Summary](DOCKER-DEPLOYMENT-SUMMARY.md) for details.

---

## ✅ Pre-Deployment Checklist

Before deploying, ensure:

### Required
- [ ] Python 3.11+ installed
- [ ] Node.js 18+ installed
- [ ] Docker installed (for Docker deployment)
- [ ] Ollama installed (for AI features)
- [ ] Environment variables configured
- [ ] Database initialized

### Recommended
- [ ] SSL certificates configured
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Log rotation setup
- [ ] Security review completed

See [Deployment Checklist](DEPLOYMENT-CHECKLIST.md) for complete list.

---

## 🔐 Security Considerations

### Production Deployment
1. **Environment Variables** - Never commit secrets
2. **CORS Configuration** - Restrict allowed origins
3. **SSL/TLS** - Use HTTPS in production
4. **Database** - Secure database files
5. **API Keys** - Rotate regularly

See [Complete Deployment Guide](COMPLETE-DEPLOYMENT-GUIDE.md) for security details.

---

## 🗄️ Database Migration

### Initial Setup
```bash
cd backend
python migrate_to_sqlite.py
```

### Migrating Existing Data
See [Database Migration](DATABASE_MIGRATION.md) for:
- Migration scripts
- Data validation
- Rollback procedures
- Backup strategies

---

## 🤖 AI Service Deployment

### Ollama Setup
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull model
ollama pull llama3.2:3b

# Verify
ollama list
```

See [Ollama Integration](OLLAMA-INTEGRATION-SUMMARY.md) for:
- Installation steps
- Model selection
- Performance tuning
- Troubleshooting

---

## 📈 Monitoring & Maintenance

### Health Checks
- Backend: `http://localhost:8000/docs`
- Frontend: `http://localhost:5173`
- Database: Check `backend/project_data/projects.db`

### Logs
- Backend: `docker logs <backend-container>`
- Frontend: `docker logs <frontend-container>`
- Nginx: `docker logs <nginx-container>`

### Backups
- Database: Regular backups of `project_data/projects.db`
- Configuration: Backup environment files
- Code: Git repository

---

## 🔄 Update & Rollback

### Updating
```bash
# Pull latest code
git pull origin main

# Rebuild containers
docker-compose down
docker-compose build
docker-compose up -d
```

### Rollback
```bash
# Revert to previous version
git checkout <previous-commit>
docker-compose down
docker-compose build
docker-compose up -d
```

---

## 🆘 Deployment Troubleshooting

### Common Issues
1. **Port conflicts** - Check ports 8000, 5173, 80, 443
2. **Database locked** - Ensure single backend instance
3. **Ollama not found** - Verify Ollama installation
4. **CORS errors** - Check CORS configuration

See [../troubleshooting/](../troubleshooting/) for more help.

---

## 🔗 Related Documentation

- [Guides](../guides/) - Setup and usage guides
- [Architecture](../architecture/) - System architecture
- [Troubleshooting](../troubleshooting/) - Fix deployment issues

