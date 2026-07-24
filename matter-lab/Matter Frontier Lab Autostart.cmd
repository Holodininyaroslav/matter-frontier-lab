@echo off
rem Use an ASCII-only junction because cmd.exe can misread a Cyrillic path at sign-in.
start "Matter Frontier Lab" /min "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Users\79090\MatterFrontierLab\Start-MatterFrontierLab.ps1"
