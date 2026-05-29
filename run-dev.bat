@echo off
title DBEW - DB Blueprint Designer

REM ===== Move to project folder =====
cd /d "%~dp0"
if errorlevel 1 (
    echo [ERROR] Failed to change directory.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   DBEW (DB Blueprint Designer) - Starting
echo ============================================
echo.

REM ===== Check Node.js =====
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found.
    echo Please install from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM ===== Run npm install only on first launch =====
if not exist "node_modules" (
    echo [First launch] Installing dependencies. This may take a few minutes...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo.
    echo [Done] Installation completed.
    echo.
)

REM ===== Open browser after 5 seconds (background) =====
start "" /min cmd /c "timeout /t 5 /nobreak > nul && start http://localhost:3000"

REM ===== Start dev server =====
echo Starting dev server. Press Ctrl+C in this window to stop.
echo.
call npm run dev

echo.
echo Server stopped. (exit code: %errorlevel%)
pause
exit /b 0
