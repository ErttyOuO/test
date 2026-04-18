# IAFM - Start All Backend Services (Optimized)
# Right-click this file -> Run with PowerShell

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$iafmDir = Split-Path -Parent (Split-Path -Parent $rootDir)
$venvRootCandidates = @(
    (Join-Path $iafmDir ".venv"),
    (Join-Path (Split-Path -Parent $iafmDir) ".venv")
)

function Get-VenvScriptsPath {
    param([string[]]$Candidates)
    foreach ($venvRoot in $Candidates) {
        $scriptsPath = Join-Path $venvRoot "Scripts"
        if (Test-Path (Join-Path $scriptsPath "python.exe")) {
            return $scriptsPath
        }
    }
    return $null
}

$venvDir = Get-VenvScriptsPath -Candidates $venvRootCandidates
$python  = if ($venvDir) { Join-Path $venvDir "python.exe" } else { $null }
$uvicorn = if ($venvDir) { Join-Path $venvDir "uvicorn.exe" } else { $null }
$nodeLauncher = Join-Path $rootDir "server_launcher.ps1"
$faceLauncher = Join-Path $rootDir "face_launcher.ps1"
$unifiedLauncher = Join-Path $rootDir "unified_launcher.ps1"

function Invoke-Pip {
    param([string[]]$Arguments)
    $oldErrorPref = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $output = & $python -m pip @Arguments 2>&1
        $script:LastPipExitCode = $LASTEXITCODE
        return $output
    } finally {
        $ErrorActionPreference = $oldErrorPref
    }
}

# === 1. 檢查必要檔案 ===
$requiredFiles = @($nodeLauncher, $faceLauncher, $unifiedLauncher)
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "[Error] Cannot find: $file" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}
if (-not $python -or -not (Test-Path $python)) {
    Write-Host "[Warn] Python venv not found. Trying to auto-fix..." -ForegroundColor Yellow

    $bootstrapMode = $null
    if (Get-Command py.exe -ErrorAction SilentlyContinue) {
        $bootstrapMode = "py"
    } elseif (Get-Command python.exe -ErrorAction SilentlyContinue) {
        $bootstrapMode = "python"
    }

    if (-not $bootstrapMode) {
        Write-Host "[Error] System Python not found, cannot auto-create venv." -ForegroundColor Red
        Write-Host "Please install Python 3 first (https://www.python.org/downloads/) then rerun launcher." -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }

    $targetVenvRoot = $venvRootCandidates[0]
    if (-not (Test-Path $targetVenvRoot)) {
        New-Item -ItemType Directory -Path $targetVenvRoot -Force | Out-Null
    }

    Write-Host "[Fix] Creating venv at: $targetVenvRoot" -ForegroundColor Cyan
    if ($bootstrapMode -eq "py") {
        & py.exe -3 -m venv $targetVenvRoot
    } else {
        & python.exe -m venv $targetVenvRoot
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Error] Failed to create venv automatically." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }

    $venvDir = Get-VenvScriptsPath -Candidates $venvRootCandidates
    $python  = if ($venvDir) { Join-Path $venvDir "python.exe" } else { $null }
    $uvicorn = if ($venvDir) { Join-Path $venvDir "uvicorn.exe" } else { $null }

    if (-not $python -or -not (Test-Path $python)) {
        Write-Host "[Error] Auto-fix completed but python.exe still missing in venv." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }

    Write-Host "[Fix] venv created successfully." -ForegroundColor Green
}
if (-not $uvicorn -or -not (Test-Path $uvicorn)) {
    Write-Host "[Info] uvicorn.exe not found. Will use 'python -m uvicorn' in launcher scripts." -ForegroundColor Yellow
}

# === 2. 檢查 Python 套件 ===
Write-Host ""
Write-Host "[0] Checking Python packages..." -ForegroundColor Cyan

$requiredPackages = @("flask", "flask-cors", "fastapi", "uvicorn", "pydantic", "python-multipart", "google-generativeai", "python-dotenv", "pillow")

# Using try/catch in case pip command fails entirely
try {
    $installedRaw = Invoke-Pip -Arguments @("list", "--format=columns") 2>&1
    if ($script:LastPipExitCode -ne 0) {
        throw "pip list failed"
    }
    $installedList = $installedRaw | ForEach-Object { ($_ -split '\s+')[0].ToLower() }
    $missing = @()
    foreach ($pkg in $requiredPackages) {
        $pkgLower = $pkg.ToLower()
        $pkgUnder = $pkgLower -replace '-', '_'
        if (($installedList -notcontains $pkgLower) -and ($installedList -notcontains $pkgUnder)) {
            $missing += $pkg
        }
    }

    if ($missing.Count -gt 0) {
        Write-Host "[0] Installing missing packages: $($missing -join ', ')" -ForegroundColor Yellow
        Invoke-Pip -Arguments (@("install") + $missing + @("--quiet"))
        if ($script:LastPipExitCode -ne 0) {
            Write-Host "[Warn] Some packages may have failed to install." -ForegroundColor Yellow
        } else {
            Write-Host "[0] All packages installed successfully." -ForegroundColor Green
        }
    } else {
        Write-Host "[0] All required packages are already installed." -ForegroundColor Green
    }
} catch {
    Write-Host "[Warn] Failed to check pip packages. Continuing anyway..." -ForegroundColor Yellow
}

# === 3. 啟動服務 ===
Write-Host ""
Write-Host "  IAFM - Starting All Backend Services" -ForegroundColor Cyan
Write-Host ""

function Get-ListeningProcessId {
    param([int]$Port)

    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($listener -and $listener.OwningProcess) {
        return [int]$listener.OwningProcess
    }

    try {
        $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
        $line = netstat -ano -p TCP | Select-String -Pattern $pattern | Select-Object -First 1
        if ($line -and $line.Matches.Count -gt 0) {
            return [int]$line.Matches[0].Groups[1].Value
        }
    } catch {}

    return $null
}

$existingFace = Get-ListeningProcessId -Port 8000
if ($existingFace) {
    try {
        $faceHealth = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/health' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if (($faceHealth.StatusCode -ge 200) -and ($faceHealth.StatusCode -lt 300) -and ($faceHealth.Content -match '"status"\s*:\s*"ok"')) {
            Write-Host "[Info] Face backend is already responding on port 8000. It will be restarted in a fresh Face window." -ForegroundColor Yellow
        } else {
            Write-Host "[Warn] Port 8000 is already in use, but /health did not match Face backend." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[Warn] Port 8000 is already in use, but Face backend health check failed. Launcher may fail if another process owns this port." -ForegroundColor Yellow
    }
}

$skipUnifiedLaunch = $false
$existingUnified = Get-ListeningProcessId -Port 8001
if ($existingUnified) {
    $skipUnifiedLaunch = $true
    Write-Host "[Info] Port 8001 is already in use. Skipping Unified launcher startup." -ForegroundColor Yellow
}

$useWt = (Get-Command wt.exe -ErrorAction SilentlyContinue)

if ($useWt) {
    Write-Host "[Info] Launching services using Windows Terminal..." -ForegroundColor Cyan
    # Build arguments:
    # 1) App 1 (Node)
    # 2) Split Vertical for App 2 (Face)
    # 3) Split Horizontal for App 3 (Unified)
    
    $wtArgs = "new-tab -d `"$rootDir`" --title `"Node.js Server`" powershell.exe -NoExit -ExecutionPolicy Bypass -File `"$nodeLauncher`""
    $wtArgs += " `; split-pane -V -d `"$rootDir`" --title `"Face Backend`" powershell.exe -NoExit -ExecutionPolicy Bypass -File `"$faceLauncher`" -ForceRestart"
    if (-not $skipUnifiedLaunch) {
        $wtArgs += " `; split-pane -H -d `"$rootDir`" --title `"Unified Backend`" powershell.exe -NoExit -ExecutionPolicy Bypass -File `"$unifiedLauncher`""
    }
    
    try {
        Start-Process wt.exe -ArgumentList $wtArgs
    } catch {
        Write-Host "[Warn] Windows Terminal Launch Failed. Falling back." -ForegroundColor Yellow
        $useWt = $false
    }
}

if (-not $useWt) {
    Write-Host "[Info] Launching services using separate PowerShell windows..." -ForegroundColor Cyan
    Start-Process powershell.exe -ArgumentList "-NoExit","-ExecutionPolicy","Bypass","-WindowStyle","Normal","-File","`"$nodeLauncher`""
    Start-Sleep -Seconds 1
    Start-Process powershell.exe -ArgumentList "-NoExit","-ExecutionPolicy","Bypass","-WindowStyle","Normal","-File","`"$faceLauncher`"","-ForceRestart"
    if (-not $skipUnifiedLaunch) {
        Start-Sleep -Seconds 1
        Start-Process powershell.exe -ArgumentList "-NoExit","-ExecutionPolicy","Bypass","-WindowStyle","Normal","-File","`"$unifiedLauncher`""
    }
}

# === 4. 等待服務就緒 ===
function Wait-ForPort {
    param([int]$Port, [string]$Name, [int]$Timeout = 60)
    Write-Host "[WAIT] Waiting for $Name (Port $Port) " -NoNewline
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.Elapsed.TotalSeconds -lt $Timeout) {
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $asyncResult = $tcpClient.BeginConnect("127.0.0.1", $Port, $null, $null)
            $success = $asyncResult.AsyncWaitHandle.WaitOne([timespan]::FromMilliseconds(500))
            if ($success) {
                # Test successful, end connection
                $tcpClient.EndConnect($asyncResult)
                $tcpClient.Close()
                Write-Host " Ready!" -ForegroundColor Green
                return $true
            }
            $tcpClient.Close()
        } catch {}
        Write-Host "." -NoNewline -ForegroundColor Cyan
    }
    Write-Host " Timeout!" -ForegroundColor Red
    return $false
}

Write-Host ""
Write-Host "[+] Waiting for services to initialize..." -ForegroundColor Cyan

$nodeReady = Wait-ForPort -Port 3000 -Name "Node.js Server"
$faceReady = Wait-ForPort -Port 8000 -Name "Face Detection Backend"
$unifiedReady = Wait-ForPort -Port 8001 -Name "Unified Chat Backend"

Write-Host ""
if ($nodeReady -and $faceReady -and $unifiedReady) {
    Write-Host "  ✅ All services launched successfully!" -ForegroundColor Green
} else {
    Write-Host "  ⚠️ Some services might not be ready, but proceeding anyway..." -ForegroundColor Yellow
}

Write-Host "  🌐 Browser: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

Start-Process "http://localhost:3000"

Read-Host "Press Enter to close this launcher"
