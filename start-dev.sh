#!/bin/bash
# Development startup script for Project Configuration Tool (Mac/Linux)
# Starts backend and frontend natively without Docker

set -e

echo "🚀 Project Configuration Tool - Development Mode"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
port_in_use() {
    lsof -i :"$1" >/dev/null 2>&1
}

# Function to kill process on port
kill_port() {
    if port_in_use "$1"; then
        echo -e "${YELLOW}⚠️  Port $1 is in use. Killing existing process...${NC}"
        lsof -ti :"$1" | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Check dependencies
echo -e "${BLUE}🔍 Checking dependencies...${NC}"

# Check Python
if ! command_exists python3; then
    echo -e "${RED}❌ Python 3 is not installed!${NC}"
    echo "Please install Python 3.8 or higher from: https://www.python.org/"
    exit 1
fi

# Check Node.js
if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed!${NC}"
    echo "Please install Node.js from: https://nodejs.org/"
    exit 1
fi

# Check npm
if ! command_exists npm; then
    echo -e "${RED}❌ npm is not installed!${NC}"
    echo "Please install npm (usually comes with Node.js)"
    exit 1
fi

echo -e "${GREEN}✅ All dependencies found${NC}"
echo ""

# Kill any existing processes on our ports
kill_port 8000  # Backend
kill_port 5173  # Frontend (Vite)

# Setup backend
echo -e "${BLUE}🐍 Setting up backend...${NC}"
cd backend

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Start backend in background
echo -e "${GREEN}🚀 Starting backend server on http://localhost:8000${NC}"
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Go back to root directory
cd ..

# Setup frontend
echo -e "${BLUE}⚛️  Setting up frontend...${NC}"
cd frontend

# Install dependencies if node_modules doesn't exist or package.json is newer
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Start frontend in background
echo -e "${GREEN}🚀 Starting frontend server on http://localhost:5173${NC}"
npm run dev &
FRONTEND_PID=$!

# Go back to root directory
cd ..

# Wait a moment for services to start
sleep 5

# Check if services are running
echo ""
echo -e "${BLUE}🏥 Checking service health...${NC}"

# Check backend
if curl -s http://localhost:8000/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is running on http://localhost:8000${NC}"
else
    echo -e "${YELLOW}⚠️  Backend is starting up (may need more time)${NC}"
fi

# Check frontend
if curl -s http://localhost:5173 >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is running on http://localhost:5173${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend is starting up (may need more time)${NC}"
fi

echo ""
echo "================================================"
echo -e "${GREEN}✅ Development servers are starting!${NC}"
echo "================================================"
echo ""
echo -e "${BLUE}🌐 Access the application:${NC}"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo -e "${BLUE}📝 Process IDs:${NC}"
echo "   Backend PID:  $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo -e "${YELLOW}🛑 To stop the servers:${NC}"
echo "   Press Ctrl+C or run: kill $BACKEND_PID $FRONTEND_PID"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping servers...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Servers stopped${NC}"
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Wait for user to stop the script
echo -e "${BLUE}⌨️  Press Ctrl+C to stop the servers${NC}"
wait