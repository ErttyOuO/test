# Unified Chat Backend Launcher
# 啟動 AI 對話整合系統後端服務

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$iafmDir = Split-Path -Parent (Split-Path -Parent $rootDir)
$workspaceDir = Split-Path -Parent $iafmDir
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
$python = if ($venvDir) { Join-Path $venvDir "python.exe" } else { $null }

function Test-PythonRuntime {
    param([string]$PythonPath)
    if (-not $PythonPath -or -not (Test-Path $PythonPath)) {
        return $false
    }

    $oldErrorPref = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $PythonPath -c "import runpy, sys; print(sys.executable)" 1>$null 2>$null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    } finally {
        $ErrorActionPreference = $oldErrorPref
    }
}

function Test-PipRuntime {
    if (-not $python -or -not (Test-Path $python)) {
        return $false
    }

    $oldErrorPref = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $python -m pip --version 1>$null 2>$null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    } finally {
        $ErrorActionPreference = $oldErrorPref
    }
}

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

function Refresh-VenvPaths {
    $script:venvDir = Get-VenvScriptsPath -Candidates $venvRootCandidates
    $script:python = if ($script:venvDir) { Join-Path $script:venvDir "python.exe" } else { $null }
}

function Ensure-VenvReady {
    param([switch]$ForceRebuild)

    if ((-not $ForceRebuild) -and (Test-PythonRuntime -PythonPath $python) -and (Test-PipRuntime)) {
        return $true
    }

    Write-Host "[Warn] Python venv missing or broken (runtime/pip check failed). Attempting auto-fix..." -ForegroundColor Yellow

    $bootstrapMode = $null
    if (Get-Command py.exe -ErrorAction SilentlyContinue) {
        $bootstrapMode = "py"
    } elseif (Get-Command python.exe -ErrorAction SilentlyContinue) {
        $bootstrapMode = "python"
    }

    if (-not $bootstrapMode) {
        Write-Host "[Error] System Python not found, cannot auto-create venv." -ForegroundColor Red
        Write-Host "Please install Python 3 first: https://www.python.org/downloads/" -ForegroundColor Yellow
        return $false
    }

    $targetVenvRoot = $venvRootCandidates[0]
    if (Test-Path $targetVenvRoot) {
        try {
            Remove-Item -Path $targetVenvRoot -Recurse -Force -ErrorAction Stop
            Write-Host "[Fix] Removed broken venv: $targetVenvRoot" -ForegroundColor Cyan
        } catch {
            Write-Host "[Warn] Failed to remove old venv. Retrying create in place..." -ForegroundColor Yellow
        }
    }

    Write-Host "[Fix] Creating venv at: $targetVenvRoot" -ForegroundColor Cyan
    if ($bootstrapMode -eq "py") {
        & py.exe -3 -m venv $targetVenvRoot
    } else {
        & python.exe -m venv $targetVenvRoot
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Error] Failed to create venv automatically." -ForegroundColor Red
        return $false
    }

    Refresh-VenvPaths

    if ((-not (Test-PythonRuntime -PythonPath $python)) -or (-not (Test-PipRuntime))) {
        Write-Host "[Error] venv created but Python runtime/pip still unusable." -ForegroundColor Red
        return $false
    }

    Write-Host "[Fix] venv auto-fix completed." -ForegroundColor Green
    return $true
}

function Ensure-RequiredPackages {
    $requiredPackages = @("fastapi", "uvicorn", "pydantic", "python-multipart", "python-dotenv", "pillow")

    Write-Host "[Info] Checking Unified backend Python packages..." -ForegroundColor Cyan
    $installedRaw = Invoke-Pip -Arguments @("list", "--format=columns") 2>&1
    if ($script:LastPipExitCode -ne 0) {
        Write-Host "[Warn] pip list failed. Attempting venv rebuild and retry..." -ForegroundColor Yellow
        if (-not (Ensure-VenvReady -ForceRebuild)) {
            Write-Host "[Error] venv rebuild failed." -ForegroundColor Red
            return $false
        }

        $installedRaw = Invoke-Pip -Arguments @("list", "--format=columns") 2>&1
        if ($script:LastPipExitCode -ne 0) {
            Write-Host "[Error] pip list still failed after rebuild. Please verify system Python." -ForegroundColor Red
            return $false
        }
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
        Write-Host "[Fix] Installing missing packages: $($missing -join ', ')" -ForegroundColor Yellow
        Invoke-Pip -Arguments (@("install") + $missing)
        if ($script:LastPipExitCode -ne 0) {
            Write-Host "[Error] Failed to install required packages." -ForegroundColor Red
            return $false
        }
        Write-Host "[Fix] Python packages installed." -ForegroundColor Green
    } else {
        Write-Host "[Info] Required Python packages already installed." -ForegroundColor Green
    }

    return $true
}
$unifiedCandidates = @(
    (Join-Path $iafmDir "backend\services\unified-chat\unified-backend.py"),
    (Join-Path $iafmDir "unified-backend.py"),
    (Join-Path $rootDir "unified-backend.py")
)
$unifiedBackend = $null
foreach ($candidate in $unifiedCandidates) {
    if (Test-Path $candidate) {
        $unifiedBackend = $candidate
        break
    }
}

if (-not $unifiedBackend) {
    $found = $null
    $searchRoots = @($iafmDir, $workspaceDir)
    foreach ($searchRoot in $searchRoots) {
        $found = Get-ChildItem -Path $searchRoot -Recurse -Filter "unified-backend.py" -File -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($found) { break }
    }
    if ($found) {
        $unifiedBackend = $found.FullName
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Unified Chat Backend Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$existingListener = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($existingListener) {
    $ownerId = $existingListener.OwningProcess
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerId" -ErrorAction SilentlyContinue
    Write-Host "[Warn] Port 8001 is already in use. Unified backend appears to be running." -ForegroundColor Yellow
    if ($owner) {
        Write-Host "[Info] Owner PID: $ownerId" -ForegroundColor Cyan
        Write-Host "[Info] Owner Name: $($owner.Name)" -ForegroundColor Cyan
        Write-Host "[Info] Owner CMD: $($owner.CommandLine)" -ForegroundColor Cyan
    } else {
        Write-Host "[Info] Owner PID: $ownerId" -ForegroundColor Cyan
    }
    exit 0
}

# 檢查 Python 環境
if (-not (Ensure-VenvReady)) {
    Read-Host "Press Enter to exit"
    exit 1
}

# 檢查 unified-backend.py
if (-not $unifiedBackend -or -not (Test-Path $unifiedBackend)) {
    Write-Host "[Error] Cannot find unified-backend.py at: $unifiedBackend" -ForegroundColor Red
    Write-Host "Checked paths:" -ForegroundColor Yellow
    foreach ($candidate in $unifiedCandidates) {
        Write-Host " - $candidate" -ForegroundColor Yellow
    }
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "[Info] Starting Unified Chat Backend..." -ForegroundColor Green
Write-Host "[Info] Backend will run on http://localhost:8001" -ForegroundColor Yellow
Write-Host "[Info] API Documentation: http://localhost:8001/docs" -ForegroundColor Yellow
Write-Host ""

if (-not (Ensure-RequiredPackages)) {
    Read-Host "Press Enter to exit"
    exit 1
}

# 切換到正確的工作目錄
Set-Location (Split-Path -Parent $unifiedBackend)

# 啟動 unified-backend.py
try {
    & $python $unifiedBackend
} catch {
    Write-Host "[Error] Failed to start unified-backend.py" -ForegroundColor Red
    Write-Host "[Error] $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "[Info] Unified Chat Backend stopped." -ForegroundColor Yellow
Read-Host "Press Enter to exit"
