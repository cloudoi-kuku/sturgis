@echo off
REM Quick start script for Project Configuration Tool (Windows)

echo ========================================
echo Project Configuration Tool - Docker Setup
echo ========================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed!
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker Compose is not installed!
    echo Please install Docker Desktop which includes Docker Compose
    pause
    exit /b 1
)

REM Check if Docker daemon is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker daemon is not running!
    echo Please start Docker Desktop
    pause
    exit /b 1
)

echo Docker is installed and running
echo.

REM Create .env file if it doesn't exist
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo .env file created. You can edit it to customize settings.
    echo.
)

REM Build and start services
echo Building Docker images...
docker-compose build

echo.
echo Starting services...
echo WARNING: First startup will download AI model (~2GB). This may take 5-10 minutes.
echo          Subsequent starts will be much faster.
docker-compose up -d

echo.
echo Waiting for services to be ready...
echo (AI model download in progress if first run...)
timeout /t 10 /nobreak >nul

echo.
echo Checking service health...

REM Check backend
curl -s http://localhost:8000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo Backend is healthy
) else (
    echo Backend is not responding yet (may need more time)
)

REM Check frontend
curl -s http://localhost/ >nul 2>&1
if %errorlevel% equ 0 (
    echo Frontend is healthy
) else (
    echo Frontend is not responding yet (may need more time)
)

echo.
echo ========================================
echo Project Configuration Tool is running!
echo ========================================
echo.
echo Access the application at:
echo   Frontend: http://localhost
echo   Backend:  http://localhost:8000
echo.
echo View logs:
echo   docker-compose logs -f
echo.
echo Stop the application:
echo   docker-compose down
echo.
echo For more commands, see DOCKER-README.md
echo.
pause

