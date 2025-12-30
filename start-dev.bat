@echo off
REM Development startup script for Project Configuration Tool (Windows)
REM Starts backend and frontend natively without Docker

setlocal enabledelayedexpansion

echo ========================================
echo Project Configuration Tool - Development Mode
echo ========================================
echo.

REM Function to check if command exists
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed!
    echo Please install Python 3.8 or higher from: https://www.python.org/
    pause
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed!
    echo Please install npm (usually comes with Node.js)
    pause
    exit /b 1
)

echo All dependencies found
echo.

REM Kill any existing processes on our ports
echo Checking for existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM Setup backend
echo Setting up backend...
cd backend

REM Check if virtual environment exists
if not exist venv (
    echo Creating Python virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install/update dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

REM Start backend in background
echo Starting backend server on http://localhost:8000
start "Backend Server" cmd /c "python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

REM Go back to root directory
cd ..

REM Setup frontend
echo Setting up frontend...
cd frontend

REM Install dependencies if node_modules doesn't exist
if not exist node_modules (
    echo Installing Node.js dependencies...
    npm install
) else (
    echo Node.js dependencies already installed
)

REM Start frontend in background
echo Starting frontend server on http://localhost:5173
start "Frontend Server" cmd /c "npm run dev"

REM Go back to root directory
cd ..

REM Wait a moment for services to start
echo.
echo Waiting for services to start...
timeout /t 5 /nobreak >nul

REM Check if services are running
echo.
echo Checking service health...

REM Check backend (simple ping)
ping -n 1 localhost >nul 2>&1
if %errorlevel% equ 0 (
    echo Backend should be starting on http://localhost:8000
) else (
    echo Backend may need more time to start
)

REM Check frontend (simple ping)
ping -n 1 localhost >nul 2>&1
if %errorlevel% equ 0 (
    echo Frontend should be starting on http://localhost:5173
) else (
    echo Frontend may need more time to start
)

echo.
echo ========================================
echo Development servers are starting!
echo ========================================
echo.
echo Access the application:
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo To stop the servers:
echo   Close this window or press Ctrl+C in the server windows
echo.
echo Opening frontend in your default browser...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo Press any key to exit this script (servers will continue running)
pause >nul