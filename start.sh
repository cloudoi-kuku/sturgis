#!/bin/bash
# Quick start script for MS Project Configuration Tool (Linux/Mac)

set -e

echo "🚀 MS Project Configuration Tool - Docker Setup"
echo "================================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed!"
    echo "Please install Docker Compose from: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running!"
    echo "Please start Docker Desktop or Docker service"
    exit 1
fi

echo "✅ Docker is installed and running"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. You can edit it to customize settings."
    echo ""
fi

# Build and start services
echo "🔨 Building Docker images..."
docker-compose build

echo ""
echo "🚀 Starting services..."
echo "⚠️  First startup will download AI model (~2GB). This may take 5-10 minutes."
echo "    Subsequent starts will be much faster."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
echo "    (AI model download in progress if first run...)"
sleep 10

# Check health
echo ""
echo "🏥 Checking service health..."

# Check backend
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ Backend is healthy"
else
    echo "⚠️  Backend is not responding yet (may need more time)"
fi

# Check frontend
if curl -s http://localhost/ > /dev/null; then
    echo "✅ Frontend is healthy"
else
    echo "⚠️  Frontend is not responding yet (may need more time)"
fi

echo ""
echo "================================================"
echo "✅ MS Project Configuration Tool is running!"
echo "================================================"
echo ""
echo "🌐 Access the application at:"
echo "   Frontend: http://localhost"
echo "   Backend:  http://localhost:8000"
echo ""
echo "📊 View logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Stop the application:"
echo "   docker-compose down"
echo ""
echo "📖 For more commands, see DOCKER-README.md"
echo ""

