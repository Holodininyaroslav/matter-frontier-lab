param(
    [int]$Port = 8892
)

# Runs at sign-in and serves the project next to this launcher. It deliberately
# uses a path derived from this launcher, so no user-specific path is stored.
$ErrorActionPreference = 'Continue'
$projectRoot = Split-Path -LiteralPath $PSScriptRoot -Parent
$serverScript = Join-Path $projectRoot 'server.py'
if (-not (Test-Path -LiteralPath $serverScript)) { exit 1 }
Set-Location -LiteralPath $projectRoot

$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
$pyCommand = Get-Command py -ErrorAction SilentlyContinue
if (-not $pythonCommand -and -not $pyCommand) { exit 1 }

while ($true) {
    if ($pythonCommand) {
        & $pythonCommand.Source -u $serverScript --host 127.0.0.1 --port $Port
    } else {
        & $pyCommand.Source -3 -u $serverScript --host 127.0.0.1 --port $Port
    }
    Start-Sleep -Seconds 3
}
