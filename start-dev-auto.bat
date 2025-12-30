@echo off
REM Development startup script for Project Configuration Tool (Windows)
REM Starts backend and frontend natively without Docker

setlocal enabledelayedexpansion

echo ========================================
echo Project Configuration Tool - Development Mode
echo ========================================
echo.

REM Check dependencies
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed!
    echo Please install Python 3.8 or higher from: https://www.python.org/
    echo.
    timeout /t 5
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from: https://nodejs.org/
    echo.
    timeout /t 5
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed!
    echo Please install npm (usually comes with Node.js)
    echo.
    timeout /t 5
    exit /b 1
)

echo ✅ All dependencies found
echo.

REM Kill any existing processes on our ports
echo 🔄 Checking for existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 2^>nul') do (
    echo   Stopping existing backend process (PID %%a)
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 2^>nul') do (
    echo   Stopping existing frontend process (PID %%a)
    taskkill /F /PID %%a >nul 2>&1
)

REM Setup backend
echo.
echo 🐍 Setting up backend...
cd backend

REM Check if virtual environment exists
if not exist venv (
    echo   Creating Python virtual environment...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo   ERROR: Failed to create virtual environment
        cd ..
        timeout /t 5
        exit /b 1
    )
)

REM Activate virtual environment
echo   Activating virtual environment...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo   ERROR: Failed to activate virtual environment
    cd ..
    timeout /t 5
    exit /b 1
)

REM Install/update dependencies
echo   Installing Python dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo   ERROR: Failed to install Python dependencies
    cd ..
    timeout /t 5
    exit /b 1
)

REM Start backend in background
echo   🚀 Starting backend server on http://localhost:8000
start "Backend Server - Project Config Tool" cmd /c "call venv\Scripts\activate.bat && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 && pause"

REM Go back to root directory
cd ..

REM Setup frontend
echo.
echo ⚛️ Setting up frontend...
cd frontend

REM Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo   Installing Node.js dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo   ERROR: Failed to install Node.js dependencies
        cd ..
        timeout /t 5
        exit /b 1
    )
) else (
    echo   ✅ Node.js dependencies already installed
)

REM Start frontend in background
echo   🚀 Starting frontend server on http://localhost:5173
start "Frontend Server - Project Config Tool" cmd /c "npm run dev && pause"

REM Go back to root directory
cd ..

REM Wait a moment for services to start
echo.
echo ⏳ Waiting for services to start...
timeout /t 8 /nobreak >nul

echo.
echo ========================================
echo ✅ Development servers are starting!
echo ========================================
echo.
echo 🌐 Access the application:
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo 📝 Server windows opened in background
echo 🛑 To stop servers: Close the "Backend Server" and "Frontend Server" windows
echo.
echo 🌍 Opening frontend in your default browser...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo ✅ Setup complete! Servers are running in background windows.
echo    You can safely close this window now.
echo.
timeout /t 3 /nobreak >nul