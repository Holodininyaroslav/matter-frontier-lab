@echo off
rem Per-user Windows Startup launcher.  It always serves the current repository
rem and restarts the local server if Python exits unexpectedly.
set "MFL_ROOT=%~dp0.."
for %%I in ("%MFL_ROOT%") do set "MFL_ROOT=%%~fI"
set "MFL_PYTHON=python"
cd /d "%MFL_ROOT%"

:restart
"%MFL_PYTHON%" -u "%MFL_ROOT%\server.py" --host 127.0.0.1 --port 8892
timeout /t 3 /nobreak >nul
goto restart
