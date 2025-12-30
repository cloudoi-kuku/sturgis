#!/bin/bash
# Stop development servers script (Mac/Linux)

echo "🛑 Stopping development servers..."

# Kill processes on ports 8000 and 5173
if lsof -i :8000 >/dev/null 2>&1; then
    echo "Stopping backend server (port 8000)..."
    lsof -ti :8000 | xargs kill -9 2>/dev/null
    echo "✅ Backend stopped"
else
    echo "No backend server running on port 8000"
fi

if lsof -i :5173 >/dev/null 2>&1; then
    echo "Stopping frontend server (port 5173)..."
    lsof -ti :5173 | xargs kill -9 2>/dev/null
    echo "✅ Frontend stopped"
else
    echo "No frontend server running on port 5173"
fi

echo "🏁 All development servers stopped"