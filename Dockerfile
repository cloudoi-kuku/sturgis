# Sturgis Project - Production Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for building
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for frontend build
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies first (better caching)
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy and build frontend
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci

COPY frontend/ ./
ENV VITE_API_URL=/api
RUN npm run build

# Copy backend
WORKDIR /app
COPY backend/ ./

# Copy frontend build to static folder
RUN mkdir -p static && cp -r frontend/dist/* static/

# Clean up frontend source (not needed at runtime)
RUN rm -rf frontend node_modules

# Create data directory
RUN mkdir -p project_data

# Expose port
EXPOSE 8000

# Run the app
CMD ["gunicorn", "main:app", "--workers", "2", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--timeout", "120"]
