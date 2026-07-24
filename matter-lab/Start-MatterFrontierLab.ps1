param(
    [int]$Port = 8892
)

# This launcher is intended to run at every Windows sign-in.  It keeps the
# local Matter Frontier Lab server alive if Python or the server exits.
$ErrorActionPreference = 'Continue'
$labRoot = $PSScriptRoot
Set-Location -LiteralPath $labRoot

$python = 'C:\\Program Files\\Python315\\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand) {
        $python = $pythonCommand.Source
    } else {
        $pyCommand = Get-Command py -ErrorAction SilentlyContinue
        if (-not $pyCommand) {
            exit 1
        }
        while ($true) {
            & $pyCommand.Source -3 -u server.py --host 127.0.0.1 --port $Port
            Start-Sleep -Seconds 3
        }
    }
}

while ($true) {
    & $python -u server.py --host 127.0.0.1 --port $Port
    Start-Sleep -Seconds 3
}
