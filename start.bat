@echo off
echo Starting SocialAuto...

:: Start backend
echo [1/2] Starting FastAPI backend on port 8000...
start "SocialAuto Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: Wait a moment for backend to start
timeout /t 3 /nobreak > nul

:: Start frontend
echo [2/2] Starting Next.js frontend on port 3000...
start "SocialAuto Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers are starting...
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
pause
