# 🐳 Docker Quick Reference Card

## 🚀 Quick Start

```bash
# Linux/Mac
./start.sh

# Windows
start.bat

# Manual
docker-compose up -d
```

**Access**: http://localhost

---

## 📋 Essential Commands

### Start/Stop

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Stop specific service
docker-compose stop backend
docker-compose stop frontend
```

### Logs

```bash
# View all logs
docker-compose logs

# Follow logs (real-time)
docker-compose logs -f

# Specific service
docker-compose logs backend
docker-compose logs frontend

# Last 100 lines
docker-compose logs --tail=100
```

### Status

```bash
# Check status
docker-compose ps

# Check health
curl http://localhost:8000/health

# Resource usage
docker stats
```

### Build

```bash
# Build images
docker-compose build

# Rebuild (no cache)
docker-compose build --no-cache

# Build and start
docker-compose up -d --build
```

---

## 🛠️ Maintenance

### Shell Access

```bash
# Backend shell
docker-compose exec backend bash

# Frontend shell
docker-compose exec frontend sh
```

### Cleanup

```bash
# Remove containers
docker-compose down

# Remove containers + volumes
docker-compose down -v

# Clean Docker system
docker system prune -a
```

### Backup/Restore

```bash
# Backup
tar -czf backup.tar.gz backend/project_data

# Restore
tar -xzf backup.tar.gz
```

---

## 🔧 Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Port Conflicts

```bash
# Linux/Mac - Find what's using port
sudo lsof -i :80
sudo lsof -i :8000

# Windows - Find what's using port
netstat -ano | findstr :80
netstat -ano | findstr :8000
```

### Health Check Failed

```bash
# Wait and check again
sleep 30
docker-compose ps

# Check backend directly
docker-compose exec backend curl http://localhost:8000/health
```

### Can't Connect to Backend

```bash
# Test network
docker-compose exec frontend ping backend

# Restart
docker-compose restart
```

---

## 📦 Makefile Shortcuts

```bash
make help           # Show all commands
make start          # Build and start
make stop           # Stop and clean
make logs           # View logs
make backup         # Backup data
make health         # Health check
```

---

## 🌐 URLs

- **Frontend**: http://localhost
- **Backend API**: http://localhost:8000
- **Health Check**: http://localhost:8000/health

---

## 📁 Important Files

- `docker-compose.yml` - Development config
- `docker-compose.prod.yml` - Production config
- `.env` - Environment variables
- `backend/Dockerfile` - Backend image
- `frontend/Dockerfile` - Frontend image
- `frontend/nginx.conf` - Nginx config

---

## 🔒 Production

```bash
# Start production
docker-compose -f docker-compose.prod.yml up -d

# Stop production
docker-compose -f docker-compose.prod.yml down

# View production logs
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 💡 Tips

1. **Always check logs first**: `docker-compose logs -f`
2. **Use health checks**: `curl http://localhost:8000/health`
3. **Backup before updates**: `make backup`
4. **Clean up regularly**: `docker system prune`
5. **Monitor resources**: `docker stats`

---

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | Change ports in `docker-compose.yml` |
| Container won't start | Check logs: `docker-compose logs` |
| Out of disk space | Run: `docker system prune -a` |
| Can't connect to backend | Restart: `docker-compose restart` |
| Changes not reflected | Rebuild: `docker-compose up -d --build` |

---

## 📚 Documentation

- **Full Guide**: [DOCKER-README.md](DOCKER-README.md)
- **Summary**: [DOCKER-DEPLOYMENT-SUMMARY.md](DOCKER-DEPLOYMENT-SUMMARY.md)
- **Checklist**: [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md)

---

**Need Help?** Check logs first: `docker-compose logs -f`

