@echo off
rem Windows Startup-folder fallback. The PowerShell watchdog restarts the
rem Python server after failures and avoids duplicate listeners on port 8892.
set "MFL_ROOT=%~dp0"
start "Matter Frontier Lab watchdog" /min "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%MFL_ROOT%Start-MatterFrontierLab.ps1" -Port 8892
