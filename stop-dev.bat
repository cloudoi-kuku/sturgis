@echo off
REM Stop development servers script (Windows)

echo Stopping development servers...

REM Kill processes on ports 8000 and 5173
echo Stopping backend server (port 8000)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /F /PID %%a >nul 2>&1
    if %errorlevel% equ 0 (
        echo Backend stopped
    )
)

echo Stopping frontend server (port 5173)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /F /PID %%a >nul 2>&1
    if %errorlevel% equ 0 (
        echo Frontend stopped
    )
)

echo All development servers stopped
pause