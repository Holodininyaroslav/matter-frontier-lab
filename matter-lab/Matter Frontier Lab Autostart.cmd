@echo off
set "LAB_ROOT=%~dp0"
start "Matter Frontier Lab" /min "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%LAB_ROOT%Start-MatterFrontierLab.ps1"
