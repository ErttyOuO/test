# Node.js Backend Launcher
# Provides clear diagnostics on machines that do not have dependencies installed yet.

$projectDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$serverCandidates = @(
    (Join-Path $projectDir 'backend\services\node-server'),
    (Join-Path $projectDir 'server')
)

$serverDir = $null
foreach ($candidate in $serverCandidates) {
    if (Test-Path (Join-Path $candidate 'package.json')) {
        $serverDir = $candidate
        break
    }
}

if (-not $serverDir) {
    $found = Get-ChildItem -Path $projectDir -Recurse -Filter 'package.json' -File -ErrorAction SilentlyContinue |
        Where-Object { Test-Path (Join-Path $_.DirectoryName 'server.js') } |
        Select-Object -First 1

    if ($found) {
        $serverDir = $found.DirectoryName
    }
}

if (-not $serverDir) {
    Write-Host '[Error] Cannot find Node backend directory with package.json + server.js.' -ForegroundColor Red
    Write-Host '[Error] Checked paths:' -ForegroundColor Yellow
    foreach ($candidate in $serverCandidates) {
        Write-Host " - $candidate" -ForegroundColor Yellow
    }
    Read-Host 'Press Enter to close'
    exit 1
}

Set-Location $serverDir

Write-Host ''
Write-Host '=== Node.js Backend Launcher ===' -ForegroundColor Cyan
Write-Host "Working directory: $serverDir"

$nodeVersionText = node -v
Write-Host "Node version: $nodeVersionText"

$nodeMajor = 0
if ($nodeVersionText -match '^v(\d+)') {
    $nodeMajor = [int]$Matches[1]
}

if ($nodeMajor -ge 22) {
    Write-Host '[Warn] Node 22+ may be unstable with some dependency sets on certain Windows machines.' -ForegroundColor Yellow
    Write-Host '[Warn] If crash persists, switch to Node 20 LTS and retry.' -ForegroundColor Yellow
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host '[Error] node is not found in PATH. Please install Node.js (LTS).' -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host '[Error] npm is not found in PATH. Please reinstall Node.js (LTS).' -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}

if (-not (Test-Path (Join-Path $serverDir 'package.json'))) {
    Write-Host '[Error] package.json not found in server directory.' -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}

function Install-Dependencies() {
    $nodeModulesPath = Join-Path $serverDir 'node_modules'

    if (-not (Test-Path $nodeModulesPath)) {
        Write-Host '[Info] node_modules not found. Running npm install...' -ForegroundColor Yellow
        npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            Write-Host '[Error] npm install failed.' -ForegroundColor Red
            Write-Host '[Next] Please manually delete the following if they exist, then rerun this launcher:' -ForegroundColor Yellow
            Write-Host "       $nodeModulesPath" -ForegroundColor Yellow
            Write-Host "       $(Join-Path $serverDir 'package-lock.json')" -ForegroundColor Yellow
            return $false
        }
    }

    return $true
}

function Try-AutoRepairAndRestart() {
    Write-Host '[Fix] Node server failed to start. Attempting npm install auto-repair...' -ForegroundColor Yellow
    npm install --no-audit --no-fund

    if ($LASTEXITCODE -ne 0) {
        Write-Host '[Error] Auto-repair npm install failed.' -ForegroundColor Red
        Write-Host '[Next] Please manually delete the following, then rerun this launcher:' -ForegroundColor Yellow
        Write-Host "       $(Join-Path $serverDir 'node_modules')" -ForegroundColor Yellow
        Write-Host "       $(Join-Path $serverDir 'package-lock.json')" -ForegroundColor Yellow
        return $false
    }

    Write-Host '[Info] Retrying node server.js after npm install...' -ForegroundColor Green
    node server.js
    return ($LASTEXITCODE -eq 0)
}

if (-not (Install-Dependencies)) {
    Read-Host 'Press Enter to close'
    exit 1
}

$existingListener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($existingListener) {
    $ownerId = $existingListener.OwningProcess
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerId" -ErrorAction SilentlyContinue
    Write-Host '[Warn] Port 3000 is already in use. Node server appears to be running.' -ForegroundColor Yellow
    if ($owner) {
        Write-Host "[Info] Owner PID: $ownerId" -ForegroundColor Cyan
        Write-Host "[Info] Owner Name: $($owner.Name)" -ForegroundColor Cyan
        Write-Host "[Info] Owner CMD: $($owner.CommandLine)" -ForegroundColor Cyan
    } else {
        Write-Host "[Info] Owner PID: $ownerId" -ForegroundColor Cyan
    }
    Read-Host 'Press Enter to close'
    exit 0
}

Write-Host '[Info] Starting Node.js server on port 3000...' -ForegroundColor Green
node server.js

$exitCode = $LASTEXITCODE

if ($exitCode -ne 0) {
    if ($exitCode -eq -1073741819) {
        Write-Host '[Error] Node crashed with Windows access violation (0xC0000005).' -ForegroundColor Red
    } else {
        Write-Host '[Warn] node server.js exited abnormally. It may be caused by missing or incomplete dependencies.' -ForegroundColor Yellow
    }

    $repairSucceeded = Try-AutoRepairAndRestart
    $exitCode = $LASTEXITCODE

    if (-not $repairSucceeded -and $exitCode -eq 0) {
        $exitCode = 1
    }
}

Write-Host "[Info] node server.js exited with code: $exitCode" -ForegroundColor Yellow

if ($exitCode -eq -1073741819) {
    Write-Host '[Next] Please install/use Node 20 LTS, then run this launcher again.' -ForegroundColor Yellow
}

Read-Host 'Press Enter to close'
exit $exitCode
