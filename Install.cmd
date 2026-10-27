@echo off
setlocal
set "PSModulePath="
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install.ps1" %*
if errorlevel 1 (
  echo.
  echo Installation did not complete. The message above explains the next step.
  pause
  exit /b 1
)
