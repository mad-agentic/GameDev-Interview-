@echo off
setlocal

cd /d "%~dp0"

echo ======================================
echo   GameDev Copilot - Start
echo ======================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not in PATH.
  echo Please install Node.js, then run this file again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] node_modules not found. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [INFO] Starting Electron app...
call npm start
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] App exited with code %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%
