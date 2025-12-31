# 🐳 Docker Deployment Guide

This guide explains how to run the Sturgis Project using Docker on any operating system.

## 📋 Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
- **Docker Compose** (usually included with Docker Desktop)
- At least 2GB of free RAM
- At least 2GB of free disk space

### Install Docker

#### Windows
1. Download [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. Run the installer
3. Restart your computer
4. Verify: `docker --version` and `docker-compose --version`

#### macOS
1. Download [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
2. Drag Docker.app to Applications
3. Launch Docker Desktop
4. Verify: `docker --version` and `docker-compose --version`

#### Linux (Ubuntu/Debian)
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Add your user to docker group (optional, to run without sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

---

## 🚀 Quick Start

### 1. Clone or Download the Project

```bash
cd /path/to/ms-project-tool
```

### 2. Start the Application

```bash
docker-compose up -d
```

This will:
- Build the backend and frontend Docker images
- Pull and start the Ollama AI service
- Download the Llama 3.2 model (first time only, ~2GB)
- Start all services
- Set up networking between them
- Expose the application on port 80

**Note**: First startup will take 5-10 minutes to download the AI model. Subsequent starts are much faster.

### 3. Access the Application

Open your browser and navigate to:
```
http://localhost
```

The backend API will be available at:
```
http://localhost:8000
```

### 4. Stop the Application

```bash
docker-compose down
```

---

## 📦 Docker Commands Reference

### Build and Start
```bash
# Build and start all services
docker-compose up -d

# Build and start with logs visible
docker-compose up

# Rebuild images (after code changes)
docker-compose up -d --build

# Build specific service
docker-compose build backend
docker-compose build frontend
```

### Stop and Remove
```bash
# Stop services (keeps containers)
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop, remove containers, and remove volumes
docker-compose down -v
```

### View Logs
```bash
# View all logs
docker-compose logs

# Follow logs in real-time
docker-compose logs -f

# View specific service logs
docker-compose logs backend
docker-compose logs frontend

# View last 100 lines
docker-compose logs --tail=100
```

### Service Management
```bash
# Restart a service
docker-compose restart backend
docker-compose restart frontend

# Check service status
docker-compose ps

# Execute command in running container
docker-compose exec backend bash
docker-compose exec frontend sh
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory to customize settings:

```env
# Backend
BACKEND_PORT=8000
ENVIRONMENT=production

# Frontend
FRONTEND_PORT=80

# AI Service (Ollama)
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2:3b

# OpenAI (optional, for cloud AI features)
OPENAI_API_KEY=your-api-key-here
```

### Port Configuration

To change the default ports, edit `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "8080:8000"  # Change 8080 to your desired port
  
  frontend:
    ports:
      - "3000:80"    # Change 3000 to your desired port
```

---

## 📁 Data Persistence

Project data is stored in `./backend/project_data/` and is automatically mounted as a volume. This ensures your data persists even when containers are stopped or removed.

```bash
# Backup project data
cp -r backend/project_data backend/project_data.backup

# Restore project data
cp -r backend/project_data.backup/* backend/project_data/
```

---

## 🐛 Troubleshooting

### Port Already in Use

If port 80 or 8000 is already in use:

```bash
# Find what's using the port (Linux/Mac)
sudo lsof -i :80
sudo lsof -i :8000

# Find what's using the port (Windows)
netstat -ano | findstr :80
netstat -ano | findstr :8000

# Change ports in docker-compose.yml
```

### Container Won't Start

```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Permission Issues (Linux)

```bash
# Fix ownership of project_data
sudo chown -R $USER:$USER backend/project_data

# Or run with sudo
sudo docker-compose up -d
```

### Cannot Connect to Backend

If the frontend can't connect to the backend:

```bash
# Check if both services are running
docker-compose ps

# Check network connectivity
docker-compose exec frontend ping backend

# Restart services
docker-compose restart
```

### Out of Memory

```bash
# Check Docker resource limits in Docker Desktop settings
# Increase memory allocation to at least 2GB

# Or clean up unused Docker resources
docker system prune -a
```

---

## 🏗️ Architecture

### Services

1. **Ollama (AI Service)**
   - Ollama with Llama 3.2 (3B parameters)
   - Port: 11434
   - Provides local AI capabilities
   - Model size: ~2GB
   - Health check: `/api/tags`

2. **Backend (FastAPI)**
   - Python 3.11
   - FastAPI + Uvicorn
   - Port: 8000
   - Health check: `/health`
   - Connects to Ollama for AI features

3. **Frontend (React + Vite)**
   - Node.js 20 (build stage)
   - Nginx (production)
   - Port: 80
   - API proxy: `/api/*` → `http://backend:8000/*`

### Network

- Custom bridge network: `msproject-network`
- Services communicate using service names (e.g., `http://backend:8000`)

### Volumes

- `ollama-data` → `/root/.ollama` (AI models - ~2GB)
- `./backend/project_data` → `/app/project_data` (persistent storage)
- `./backend` → `/app` (development hot reload)

---

## 🔒 Production Deployment

### Security Recommendations

1. **Use HTTPS**
   ```yaml
   # Add SSL certificates to nginx
   volumes:
     - ./ssl:/etc/nginx/ssl
   ```

2. **Set Strong Secrets**
   ```env
   SECRET_KEY=your-strong-secret-key
   OPENAI_API_KEY=your-api-key
   ```

3. **Disable Debug Mode**
   ```env
   ENVIRONMENT=production
   ```

4. **Use Docker Secrets** (Docker Swarm)
   ```yaml
   secrets:
     - openai_api_key
   ```

### Performance Optimization

1. **Use Production Build**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. **Enable Caching**
   - Frontend: Nginx caching enabled by default
   - Backend: Add Redis for caching (optional)

3. **Resource Limits**
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: '1'
             memory: 1G
   ```

---

## 🧪 Development Mode

For development with hot reload:

```bash
# Start in development mode (already configured)
docker-compose up

# The backend will auto-reload on code changes
# For frontend changes, rebuild:
docker-compose build frontend
docker-compose up -d frontend
```

### Development with Local Node Modules

If you want to develop frontend locally:

```bash
# Stop the frontend container
docker-compose stop frontend

# Run frontend locally
cd frontend
npm install
npm run dev

# Backend still runs in Docker
# Access at http://localhost:5173
```

---

## 📊 Monitoring

### Health Checks

Both services have built-in health checks:

```bash
# Check health status
docker-compose ps

# Manual health check
curl http://localhost:8000/health  # Backend
curl http://localhost/health       # Frontend
```

### Resource Usage

```bash
# View resource usage
docker stats

# View specific service
docker stats msproject-backend
docker stats msproject-frontend
```

---

## 🔄 Updates and Maintenance

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Clean Up

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything (careful!)
docker system prune -a --volumes
```

### Backup

```bash
# Backup project data
tar -czf backup-$(date +%Y%m%d).tar.gz backend/project_data

# Backup Docker volumes
docker run --rm -v msproject_project-data:/data -v $(pwd):/backup alpine tar czf /backup/volume-backup.tar.gz /data
```

---

## 🌐 Multi-Platform Support

The Docker images are built for multiple architectures:

- **amd64** (Intel/AMD x86_64)
- **arm64** (Apple Silicon M1/M2, ARM servers)

Docker will automatically use the correct image for your platform.

---

## 📞 Support

### Common Issues

1. **"Cannot connect to Docker daemon"**
   - Make sure Docker Desktop is running
   - On Linux, check: `sudo systemctl status docker`

2. **"Port is already allocated"**
   - Change ports in `docker-compose.yml`
   - Or stop the conflicting service

3. **"No space left on device"**
   - Run: `docker system prune -a`
   - Free up disk space

### Getting Help

- Check logs: `docker-compose logs`
- Check service status: `docker-compose ps`
- Restart services: `docker-compose restart`
- Rebuild from scratch: `docker-compose down -v && docker-compose up -d --build`

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Backend is running: `curl http://localhost:8000/health`
- [ ] Frontend is accessible: Open `http://localhost` in browser
- [ ] Can upload XML file
- [ ] Can create/edit tasks
- [ ] Can export XML file
- [ ] AI features work (if API key configured)
- [ ] Data persists after restart: `docker-compose restart`

---

## 🎉 Success!

Your Sturgis Project is now running in Docker! 🚀

Access it at: **http://localhost**

For questions or issues, check the logs or refer to the troubleshooting section above.


