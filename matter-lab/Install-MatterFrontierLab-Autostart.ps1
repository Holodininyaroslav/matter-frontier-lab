param(
    [int]$Port = 8892,
    [string]$TaskName = 'MatterFrontierLabLocalServer'
)

# Install two independent, per-user launch paths:
# 1. Task Scheduler starts the watchdog shortly after sign-in.
# 2. The Windows Startup folder is a fallback if Task Scheduler is unavailable.
# The watchdog itself restarts Python whenever the server exits unexpectedly.
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'Start-MatterFrontierLab.ps1'
$startupSource = Join-Path $PSScriptRoot 'Matter Frontier Lab Startup.cmd'
if (-not (Test-Path -LiteralPath $launcher)) { throw "Launcher was not found: $launcher" }
if (-not (Test-Path -LiteralPath $startupSource)) { throw "Startup fallback was not found: $startupSource" }

$powershell = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
$arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`" -Port $Port"
$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtLogOn
$trigger.Delay = 'PT15S'
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew

$taskInstalled = $false
try {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description 'Matter Frontier Lab local-server watchdog. Starts at sign-in and relaunches the server after an unexpected exit.' -Force | Out-Null
    Start-ScheduledTask -TaskName $TaskName
    $taskInstalled = $true
} catch {
    # Some locked-down Windows configurations prohibit scheduled tasks even
    # for the signed-in user. The two per-user fallbacks below remain active.
    Write-Warning "Task Scheduler setup was denied: $($_.Exception.Message)"
}

$startupDirectory = [Environment]::GetFolderPath('Startup')
$startupDestination = Join-Path $startupDirectory 'Matter Frontier Lab Startup.cmd'
$startupCommand = @"
@echo off
start "Matter Frontier Lab watchdog" /min "$powershell" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$launcher" -Port $Port
"@
Set-Content -LiteralPath $startupDestination -Value $startupCommand -Encoding Ascii -Force

$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runValue = "`"$powershell`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`" -Port $Port"
New-Item -Path $runKey -Force | Out-Null
Set-ItemProperty -Path $runKey -Name 'MatterFrontierLabLocalServer' -Value $runValue

if (-not $taskInstalled) {
    Start-Process -FilePath $powershell -ArgumentList $arguments -WindowStyle Hidden
}
Write-Output "Installed watchdog for port $Port. Task Scheduler: $taskInstalled; Startup-folder and HKCU Run fallbacks: enabled."
