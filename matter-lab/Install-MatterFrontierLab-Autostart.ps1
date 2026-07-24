param(
    [string]$TaskName = 'Matter Frontier Lab — local server'
)

$launcher = Join-Path $PSScriptRoot 'Start-MatterFrontierLab.ps1'
if (-not (Test-Path -LiteralPath $launcher)) {
    throw "Launcher was not found: $launcher"
}

$powershell = "$env:WINDIR\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
$taskCommand = '"{0}" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{1}"' -f $powershell, $launcher

# A per-user ONLOGON task does not require administrator privileges and is
# independent of the browser or Codex.  The launcher itself restarts on error.
& schtasks.exe /Create /TN $TaskName /TR $taskCommand /SC ONLOGON /RU $env:USERNAME /RL LIMITED /F | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Could not register the Windows sign-in task (exit code $LASTEXITCODE)."
}

& schtasks.exe /Run /TN $TaskName | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "The task was registered but could not be started (exit code $LASTEXITCODE)."
}

Write-Output "Registered and started: $TaskName"
