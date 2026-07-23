@echo off
setlocal
cd /d "%~dp0"
echo Starting QCD ^& Neutrino Research Lab at http://127.0.0.1:8892/
:restart
python server.py --host 127.0.0.1 --port 8892
echo Server stopped. Restarting in 2 seconds. Press Ctrl+C to exit.
timeout /t 2 /nobreak >nul
goto restart
