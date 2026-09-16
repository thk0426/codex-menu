@echo off
setlocal
set "MENU_NODE=node"
where node >nul 2>&1
if errorlevel 1 set "MENU_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%MENU_NODE%" "%~dp0scripts\start-preview.js"
if errorlevel 1 (
  pause
  exit /b 1
)
start "" "http://localhost:3000/"
endlocal

