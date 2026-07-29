param([int]$Port = 8892)

# Long-running local-server watchdog. It is launched by Task Scheduler and by
# the Startup-folder fallback; only one copy owns the port at a time.
$ErrorActionPreference = 'Continue'
$projectRoot = Split-Path -Path $PSScriptRoot -Parent
$serverScript = Join-Path $projectRoot 'server.py'
$logDirectory = Join-Path $PSScriptRoot 'logs'
$logFile = Join-Path $logDirectory 'local-server-watchdog.log'
$serverOutput = Join-Path $logDirectory 'local-server.stdout.log'

if (-not (Test-Path -LiteralPath $serverScript)) { exit 1 }
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Write-WatchdogLog([string]$Message) {
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Message" | Add-Content -LiteralPath $logFile
}

function Get-WorkingPython {
    $candidates = @()
    # Prefer the full interpreter instead of the Windows launcher.  The latter
    # can return exit code 2 at sign-in when its default Python version has not
    # been initialised yet.
    foreach ($name in @('python', 'py')) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command -and $command.CommandType -eq 'Application') { $candidates += $command.Source }
    }
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        try {
            & $candidate --version *> $null
            if ($LASTEXITCODE -eq 0) { return $candidate }
        } catch { }
    }
    return $null
}

$existingListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existingListener) {
    Write-WatchdogLog "Port $Port already has a listener; duplicate watchdog exits."
    exit 0
}

$python = Get-WorkingPython
if (-not $python) {
    Write-WatchdogLog 'No working Python executable was found.'
    exit 1
}

Set-Location -LiteralPath $projectRoot
Write-WatchdogLog "Resolved project=[$projectRoot] server=[$serverScript]"
while ($true) {
    Write-WatchdogLog "Starting server on 127.0.0.1:$Port with $python"
    # Use direct invocation rather than Start-Process: this preserves the
    # complete script path even when the interpreter lives under Program Files.
    & $python '-u' $serverScript '--host' '127.0.0.1' '--port' "$Port" *>> $serverOutput
    $exitCode = $LASTEXITCODE
    Write-WatchdogLog "Server exited with code $exitCode; retrying in 3 seconds."
    Start-Sleep -Seconds 3
}
