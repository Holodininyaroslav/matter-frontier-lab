$ErrorActionPreference = 'Continue'
$logPath = Join-Path $PSScriptRoot 'logs\wsl-service-recovery.log'
New-Item -ItemType Directory -Path (Split-Path $logPath -Parent) -Force | Out-Null

function Write-RecoveryLog([string]$Message) {
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Message" | Add-Content -LiteralPath $logPath
}

Write-RecoveryLog 'Elevated WSL service recovery started.'
try {
    Stop-Service -Name 'LxssManager' -Force -ErrorAction Stop
    Write-RecoveryLog 'LxssManager stopped.'
} catch {
    Write-RecoveryLog "LxssManager stop: $($_.Exception.Message)"
}
Start-Sleep -Seconds 2
try {
    Start-Service -Name 'LxssManager' -ErrorAction Stop
    Write-RecoveryLog 'LxssManager started.'
} catch {
    Write-RecoveryLog "LxssManager start: $($_.Exception.Message)"
}

$userService = Get-Service -Name 'LxssManagerUser_*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($userService) {
    try {
        Start-Service -Name $userService.Name -ErrorAction Stop
        Write-RecoveryLog "$($userService.Name) started."
    } catch {
        Write-RecoveryLog "$($userService.Name) start: $($_.Exception.Message)"
    }
} else {
    Write-RecoveryLog 'No LxssManagerUser service was found.'
}
Write-RecoveryLog 'Elevated WSL service recovery finished.'
