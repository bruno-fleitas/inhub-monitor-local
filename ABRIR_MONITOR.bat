@echo off
setlocal
cd /d "%~dp0"
title INHUB Monitor Local
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-monitor.ps1"
if errorlevel 1 (
  echo.
  echo No se pudo iniciar INHUB Monitor Local.
  echo Copia el mensaje de error y envialo por el chat.
  echo.
  pause
)
endlocal
