param(
    [int]$Port = 8892
)

# Desktop-shortcut entry point.  It starts the durable watchdog only when the
# local lab is not already available, waits briefly for the HTTP endpoint and
# then opens the application in the user's default browser.
$projectRoot = Split-Path -Path $PSScriptRoot -Parent
$watchdog = Join-Path $PSScriptRoot 'Start-MatterFrontierLab.ps1'
$url = "http://127.0.0.1:$Port/matter-lab/"

function Test-LabReady {
    try {
        $reply = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2
        return $reply.StatusCode -eq 200
    } catch {
        return $false
    }
}

if (-not (Test-LabReady)) {
    Start-Process -FilePath "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
        '-File', $watchdog, '-Port', $Port
    ) -WindowStyle Hidden

    for ($attempt = 0; $attempt -lt 12; $attempt++) {
        Start-Sleep -Milliseconds 500
        if (Test-LabReady) { break }
    }
}

Start-Process $url
