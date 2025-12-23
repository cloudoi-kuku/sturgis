# Deployment Guide - MS Project Configuration Tool

## Production Deployment Options

### Option 1: Docker Deployment (Recommended)

#### Create Dockerfile for Backend

**backend/Dockerfile:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Create Dockerfile for Frontend

**frontend/Dockerfile:**
```dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Create docker-compose.yml

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - PYTHONUNBUFFERED=1
    volumes:
      - ./backend:/app
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

#### Deploy with Docker

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 2: Cloud Deployment (AWS/Azure/GCP)

#### Backend Deployment

**AWS Elastic Beanstalk:**
```bash
# Install EB CLI
pip install awsebcli

# Initialize EB application
cd backend
eb init -p python-3.11 ms-project-backend

# Create environment and deploy
eb create ms-project-backend-env
eb deploy
```

**Azure App Service:**
```bash
# Install Azure CLI
# Create resource group
az group create --name ms-project-rg --location eastus

# Create App Service plan
az appservice plan create --name ms-project-plan --resource-group ms-project-rg --sku B1 --is-linux

# Create web app
az webapp create --resource-group ms-project-rg --plan ms-project-plan --name ms-project-backend --runtime "PYTHON:3.11"

# Deploy code
cd backend
az webapp up --name ms-project-backend --resource-group ms-project-rg
```

#### Frontend Deployment

**Netlify:**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Build frontend
cd frontend
npm run build

# Deploy
netlify deploy --prod --dir=dist
```

**Vercel:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel --prod
```

**AWS S3 + CloudFront:**
```bash
# Build frontend
cd frontend
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### Option 3: Traditional Server Deployment

#### Backend on Linux Server

```bash
# Install Python and dependencies
sudo apt update
sudo apt install python3.11 python3.11-venv nginx

# Clone repository
git clone <your-repo-url>
cd ms-project-tool/backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Install and configure Gunicorn
pip install gunicorn

# Create systemd service
sudo nano /etc/systemd/system/ms-project-backend.service
```

**Service file content:**
```ini
[Unit]
Description=MS Project Backend API
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/path/to/backend
Environment="PATH=/path/to/backend/venv/bin"
ExecStart=/path/to/backend/venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000

[Install]
WantedBy=multi-user.target
```

```bash
# Start service
sudo systemctl start ms-project-backend
sudo systemctl enable ms-project-backend
```

#### Frontend on Nginx

```bash
# Build frontend
cd frontend
npm run build

# Copy build to nginx directory
sudo cp -r dist/* /var/www/html/ms-project/

# Configure nginx
sudo nano /etc/nginx/sites-available/ms-project
```

**Nginx configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/html/ms-project;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ms-project /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Environment Configuration

### Production Environment Variables

**Backend (.env):**
```env
ENVIRONMENT=production
ALLOWED_ORIGINS=https://your-domain.com
MAX_UPLOAD_SIZE=10485760
LOG_LEVEL=INFO
```

**Frontend (.env.production):**
```env
VITE_API_URL=https://api.your-domain.com
```

## Security Considerations

1. **HTTPS/SSL:**
   - Use Let's Encrypt for free SSL certificates
   - Configure SSL in nginx or use cloud provider's SSL

2. **CORS:**
   - Update allowed origins in backend to match production domain
   - Remove localhost from production CORS settings

3. **File Upload Limits:**
   - Set maximum file size limits
   - Validate file types server-side

4. **Rate Limiting:**
   - Implement rate limiting on API endpoints
   - Use nginx or API gateway for rate limiting

5. **Authentication (Future Enhancement):**
   - Add user authentication
   - Implement JWT tokens
   - Secure API endpoints

## Monitoring and Logging

### Application Monitoring

```python
# Add to backend/main.py
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
```

### Health Check Endpoint

Add to backend/main.py:
```python
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
```

## Backup and Recovery

1. **Database Backups** (if using database in future)
2. **Configuration Backups**
3. **Regular snapshots of server/container**

## Performance Optimization

1. **Frontend:**
   - Enable gzip compression in nginx
   - Use CDN for static assets
   - Implement code splitting

2. **Backend:**
   - Use caching for frequently accessed data
   - Optimize XML parsing for large files
   - Consider async processing for large uploads

## Scaling Considerations

1. **Horizontal Scaling:**
   - Use load balancer (nginx, AWS ALB)
   - Deploy multiple backend instances
   - Use shared storage for uploaded files

2. **Vertical Scaling:**
   - Increase server resources as needed
   - Monitor CPU and memory usage

## Maintenance

1. **Updates:**
   - Keep dependencies up to date
   - Test updates in staging environment first

2. **Backups:**
   - Regular backups of configuration
   - Version control for all code

3. **Monitoring:**
   - Set up alerts for errors
   - Monitor API response times
   - Track user activity

## Rollback Plan

1. Keep previous version deployed
2. Use blue-green deployment strategy
3. Have database migration rollback scripts ready
4. Document rollback procedures

