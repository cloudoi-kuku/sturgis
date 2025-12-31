# 🚀 Docker Deployment Checklist

Use this checklist to ensure successful deployment of the Sturgis Project.

---

## Pre-Deployment Checks

### System Requirements

- [ ] **Docker Desktop** installed (Windows/Mac) or **Docker Engine** (Linux)
- [ ] **Docker Compose** installed (usually included with Docker Desktop)
- [ ] At least **2GB free RAM**
- [ ] At least **2GB free disk space**
- [ ] Ports **80** and **8000** are available (not in use)

### Verify Docker Installation

```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker-compose --version

# Verify Docker is running
docker info
```

Expected output:
- Docker version 20.10+ or higher
- Docker Compose version 2.0+ or higher
- No errors from `docker info`

---

## Deployment Steps

### 1. Prepare Environment

- [ ] Clone or download the project repository
- [ ] Navigate to project root directory
- [ ] Create `.env` file from template:
  ```bash
  cp .env.example .env
  ```
- [ ] (Optional) Edit `.env` to customize settings

### 2. Build Docker Images

```bash
# Validate configuration
docker-compose config

# Build images
docker-compose build
```

- [ ] No errors during configuration validation
- [ ] Backend image builds successfully
- [ ] Frontend image builds successfully

### 3. Start Services

```bash
# Start in detached mode
docker-compose up -d

# Or use the helper script
./start.sh  # Linux/Mac
start.bat   # Windows
```

- [ ] Backend container starts successfully
- [ ] Frontend container starts successfully
- [ ] No error messages in output

### 4. Verify Services

```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs
```

- [ ] Both containers show status "Up"
- [ ] Health checks are passing
- [ ] No critical errors in logs

---

## Post-Deployment Verification

### Health Checks

```bash
# Backend health check
curl http://localhost:8000/health

# Frontend health check
curl http://localhost/
```

- [ ] Backend returns `{"status": "healthy", ...}`
- [ ] Frontend returns HTML content (200 OK)

### Functional Testing

- [ ] **Access Frontend**: Open http://localhost in browser
- [ ] **UI Loads**: React application loads without errors
- [ ] **Upload XML**: Can upload a test MS Project XML file
- [ ] **View Tasks**: Tasks are displayed in the Gantt chart
- [ ] **Create Task**: Can create a new task
- [ ] **Edit Task**: Can edit an existing task
- [ ] **Delete Task**: Can delete a task
- [ ] **Add Dependency**: Can add task predecessors
- [ ] **Validate**: Validation runs without errors
- [ ] **Export XML**: Can export the modified XML file
- [ ] **Download Works**: Downloaded XML file is valid

### Data Persistence

```bash
# Restart services
docker-compose restart

# Wait a few seconds
sleep 5
```

- [ ] After restart, previously loaded project is still available
- [ ] Tasks and changes persist across restarts
- [ ] No data loss

---

## Troubleshooting

### If Services Don't Start

```bash
# Check detailed logs
docker-compose logs backend
docker-compose logs frontend

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### If Port Conflicts Occur

```bash
# Find what's using the port (Linux/Mac)
sudo lsof -i :80
sudo lsof -i :8000

# Find what's using the port (Windows)
netstat -ano | findstr :80
netstat -ano | findstr :8000
```

**Solution**: Either stop the conflicting service or change ports in `docker-compose.yml`

### If Health Checks Fail

```bash
# Wait longer (services may need time to start)
sleep 30

# Check again
docker-compose ps

# Access container directly
docker-compose exec backend bash
curl http://localhost:8000/health
```

### If Frontend Can't Connect to Backend

```bash
# Check network connectivity
docker-compose exec frontend ping backend

# Check backend is accessible
docker-compose exec frontend wget -O- http://backend:8000/health

# Restart services
docker-compose restart
```

---

## Production Deployment

### Additional Checks for Production

- [ ] **Environment**: Set `ENVIRONMENT=production` in `.env`
- [ ] **Secrets**: Change default `SECRET_KEY` in `.env`
- [ ] **HTTPS**: Configure SSL certificates (if needed)
- [ ] **Firewall**: Configure firewall rules
- [ ] **Backups**: Set up automated backups
- [ ] **Monitoring**: Set up monitoring and alerting
- [ ] **Resource Limits**: Review and adjust in `docker-compose.prod.yml`

### Production Deployment Command

```bash
# Use production configuration
docker-compose -f docker-compose.prod.yml up -d
```

- [ ] Services start with production configuration
- [ ] Resource limits are applied
- [ ] Log rotation is working
- [ ] Restart policy is set to "always"

---

## Maintenance

### Regular Tasks

- [ ] **Monitor Logs**: `docker-compose logs -f`
- [ ] **Check Disk Space**: `docker system df`
- [ ] **Backup Data**: `make backup` or manual backup
- [ ] **Update Images**: Rebuild after code changes
- [ ] **Clean Up**: `docker system prune` periodically

### Backup Procedure

```bash
# Create backup
make backup

# Or manually
tar -czf backup-$(date +%Y%m%d).tar.gz backend/project_data
```

- [ ] Backup created successfully
- [ ] Backup file is not empty
- [ ] Backup stored in safe location

### Update Procedure

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

- [ ] Code updated successfully
- [ ] Images rebuilt without errors
- [ ] Services restart successfully
- [ ] Application works after update

---

## Security Checklist

- [ ] **Secrets**: No secrets committed to Git
- [ ] **Environment**: `.env` file is in `.gitignore`
- [ ] **CORS**: Only necessary origins are allowed
- [ ] **Ports**: Only necessary ports are exposed
- [ ] **Updates**: Base images are up to date
- [ ] **Permissions**: Containers run as non-root user
- [ ] **Network**: Services use isolated Docker network

---

## Performance Checklist

- [ ] **Resource Usage**: Check with `docker stats`
- [ ] **Memory**: Containers stay within limits
- [ ] **CPU**: No excessive CPU usage
- [ ] **Disk**: Sufficient disk space available
- [ ] **Response Time**: API responds quickly (<1s)
- [ ] **Frontend Load**: Page loads quickly (<3s)

---

## Documentation

- [ ] **README.md**: Updated with Docker instructions
- [ ] **DOCKER-README.md**: Comprehensive Docker guide available
- [ ] **DEPLOYMENT-SUMMARY.md**: Architecture documented
- [ ] **Team Training**: Team knows how to use Docker commands

---

## Final Sign-Off

### Deployment Completed By

- **Name**: ___________________________
- **Date**: ___________________________
- **Environment**: [ ] Development [ ] Staging [ ] Production

### Verification

- [ ] All pre-deployment checks passed
- [ ] All deployment steps completed
- [ ] All post-deployment verifications passed
- [ ] All functional tests passed
- [ ] Documentation is complete
- [ ] Team has been notified

### Notes

```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```

---

## Quick Reference

### Start Application
```bash
./start.sh          # Linux/Mac
start.bat           # Windows
make start          # Using Makefile
```

### Stop Application
```bash
docker-compose down
make down
```

### View Logs
```bash
docker-compose logs -f
make logs
```

### Backup Data
```bash
make backup
```

### Access Application
- **Frontend**: http://localhost
- **Backend**: http://localhost:8000

---

## Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Review [DOCKER-README.md](DOCKER-README.md)
3. Check [DOCKER-DEPLOYMENT-SUMMARY.md](DOCKER-DEPLOYMENT-SUMMARY.md)
4. Verify all checklist items above

---

**✅ Deployment Complete!**

