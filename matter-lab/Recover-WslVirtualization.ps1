$ErrorActionPreference = 'Continue'
$logPath = Join-Path $PSScriptRoot 'logs\wsl-virtualization-recovery.log'
New-Item -ItemType Directory -Path (Split-Path $logPath -Parent) -Force | Out-Null

function Write-RecoveryLog([string]$Message) {
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $Message" | Add-Content -LiteralPath $logPath
}

Write-RecoveryLog 'Elevated WSL virtualization recovery started.'
foreach ($serviceName in @('LxssManager', 'vmcompute')) {
    try {
        Stop-Service -Name $serviceName -Force -ErrorAction Stop
        Write-RecoveryLog "$serviceName stopped."
    } catch {
        Write-RecoveryLog "$serviceName stop: $($_.Exception.Message)"
    }
}
Start-Sleep -Seconds 3
foreach ($serviceName in @('vmcompute', 'LxssManager')) {
    try {
        Start-Service -Name $serviceName -ErrorAction Stop
        Write-RecoveryLog "$serviceName started."
    } catch {
        Write-RecoveryLog "$serviceName start: $($_.Exception.Message)"
    }
}
$userService = Get-Service -Name 'LxssManagerUser_*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($userService) {
    try {
        Start-Service -Name $userService.Name -ErrorAction Stop
        Write-RecoveryLog "$($userService.Name) started."
    } catch {
        Write-RecoveryLog "$($userService.Name) start: $($_.Exception.Message)"
    }
}
Write-RecoveryLog 'Elevated WSL virtualization recovery finished.'
