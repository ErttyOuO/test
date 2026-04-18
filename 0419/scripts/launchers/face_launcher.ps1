# Face Detection Backend Launcher
# This small script is launched by start_all.ps1 to avoid Unicode path issues
param(
	[switch]$ForceRestart
)

$ErrorActionPreference = "Stop"
# Avoid inheriting broken global Python env settings on new/migrated machines.
$env:PYTHONHOME = ""
$env:PYTHONPATH = ""
$iafmDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$workspaceDir = Split-Path -Parent $iafmDir
$venvRootCandidates = @(
	(Join-Path $iafmDir '.venv'),
	(Join-Path (Split-Path -Parent $iafmDir) '.venv')
)

function Get-VenvScriptsPath {
	param([string[]]$Candidates)
	foreach ($venvRoot in $Candidates) {
		$scriptsPath = Join-Path $venvRoot 'Scripts'
		if (Test-Path (Join-Path $scriptsPath 'python.exe')) {
			return $scriptsPath
		}
	}
	return $null
}

$venvDir = Get-VenvScriptsPath -Candidates $venvRootCandidates
$python = if ($venvDir) { Join-Path $venvDir 'python.exe' } else { $null }

function Test-PythonRuntime {
	param([string]$PythonPath)
	if (-not $PythonPath -or -not (Test-Path $PythonPath)) {
		return $false
	}

	$oldErrorPref = $ErrorActionPreference
	try {
		$ErrorActionPreference = 'Continue'
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
		$ErrorActionPreference = 'Continue'
		& $python -m pip --version 1>$null 2>$null
		return ($LASTEXITCODE -eq 0)
	} catch {
		return $false
	} finally {
		$ErrorActionPreference = $oldErrorPref
	}
}

function Refresh-VenvPaths {
	$script:venvDir = Get-VenvScriptsPath -Candidates $venvRootCandidates
	$script:python = if ($script:venvDir) { Join-Path $script:venvDir 'python.exe' } else { $null }
}

function Invoke-Pip {
	param([string[]]$Arguments)
	$oldErrorPref = $ErrorActionPreference
	try {
		$ErrorActionPreference = 'Continue'
		$output = & $python -m pip @Arguments 2>&1
		$script:LastPipExitCode = $LASTEXITCODE
		return $output
	} finally {
		$ErrorActionPreference = $oldErrorPref
	}
}

function Ensure-VenvReady {
	param([switch]$ForceRebuild)

	if ((-not $ForceRebuild) -and (Test-PythonRuntime -PythonPath $python) -and (Test-PipRuntime)) {
		return $true
	}

	Write-Host '[Warn] Python venv missing or broken (runtime/pip check failed). Attempting auto-fix...' -ForegroundColor Yellow

	$bootstrapMode = $null
	if (Get-Command py.exe -ErrorAction SilentlyContinue) {
		$bootstrapMode = 'py'
	} elseif (Get-Command python.exe -ErrorAction SilentlyContinue) {
		$bootstrapMode = 'python'
	}

	if (-not $bootstrapMode) {
		Write-Host '[Error] System Python not found, cannot auto-create venv.' -ForegroundColor Red
		Write-Host 'Please install Python 3 first: https://www.python.org/downloads/' -ForegroundColor Yellow
		return $false
	}

	$targetVenvRoot = $venvRootCandidates[0]
	if (Test-Path $targetVenvRoot) {
		try {
			Remove-Item -Path $targetVenvRoot -Recurse -Force -ErrorAction Stop
			Write-Host "[Fix] Removed broken venv: $targetVenvRoot" -ForegroundColor Cyan
		} catch {
			Write-Host '[Warn] Failed to remove old venv. Retrying create in place...' -ForegroundColor Yellow
		}
	}

	Write-Host "[Fix] Creating venv at: $targetVenvRoot" -ForegroundColor Cyan
	if ($bootstrapMode -eq 'py') {
		& py.exe -3 -m venv $targetVenvRoot
	} else {
		& python.exe -m venv $targetVenvRoot
	}

	if ($LASTEXITCODE -ne 0) {
		Write-Host '[Error] Failed to create venv automatically.' -ForegroundColor Red
		return $false
	}

	Refresh-VenvPaths

	if ((-not (Test-PythonRuntime -PythonPath $python)) -or (-not (Test-PipRuntime))) {
		Write-Host '[Error] venv created but Python runtime/pip still unusable.' -ForegroundColor Red
		return $false
	}

	Write-Host '[Fix] venv auto-fix completed.' -ForegroundColor Green
	return $true
}

function Ensure-RequiredPackages {
	$requiredPackages = @('fastapi', 'uvicorn', 'pydantic', 'python-multipart', 'google-generativeai', 'python-dotenv')

	Write-Host '[Info] Checking Face backend Python packages...' -ForegroundColor Cyan
	$installedRaw = Invoke-Pip -Arguments @('list', '--format=columns') 2>&1
	if ($script:LastPipExitCode -ne 0) {
		Write-Host '[Warn] pip list failed. Attempting venv rebuild and retry...' -ForegroundColor Yellow
		if (-not (Ensure-VenvReady -ForceRebuild)) {
			Write-Host '[Error] venv rebuild failed.' -ForegroundColor Red
			return $false
		}

		$installedRaw = Invoke-Pip -Arguments @('list', '--format=columns') 2>&1
		if ($script:LastPipExitCode -ne 0) {
			Write-Host '[Error] pip list still failed after rebuild. Please verify system Python.' -ForegroundColor Red
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
		Invoke-Pip -Arguments (@('install') + $missing)
		if ($script:LastPipExitCode -ne 0) {
			Write-Host '[Error] Failed to install required packages.' -ForegroundColor Red
			return $false
		}
		Write-Host '[Fix] Python packages installed.' -ForegroundColor Green
	} else {
		Write-Host '[Info] Required Python packages already installed.' -ForegroundColor Green
	}

	return $true
}

function Test-FaceBackendHealth {
	param(
		[string]$Url = 'http://127.0.0.1:8000/health',
		[int]$Attempts = 5,
		[int]$DelayMs = 500
	)

	for ($i = 0; $i -lt $Attempts; $i++) {
		try {
			$response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
			$isOk = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
			$bodyLooksRight = ($response.Content -match '"status"\s*:\s*"ok"')
			if ($isOk -and $bodyLooksRight) {
				return $true
			}
		} catch {}

		if ($i -lt ($Attempts - 1)) {
			Start-Sleep -Milliseconds $DelayMs
		}
	}

	return $false
}

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

function Wait-ForPortRelease {
	param(
		[int]$Port,
		[int]$TimeoutSec = 12
	)

	$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
	while ($stopwatch.Elapsed.TotalSeconds -lt $TimeoutSec) {
		if (-not (Get-ListeningProcessId -Port $Port)) {
			return $true
		}
		Start-Sleep -Milliseconds 250
	}

	return $false
}

function Test-ProcessExists {
	param([int]$ProcessId)

	if ($ProcessId -le 0) {
		return $false
	}

	return [bool](Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Stop-FaceBackendOwner {
	param(
		[int]$OwnerId,
		$OwnerProcess
	)

	$targetId = $OwnerId
	$targetName = if ($OwnerProcess) { $OwnerProcess.Name } else { 'unknown' }

	if ($OwnerProcess) {
		$parentId = 0
		try {
			$parentId = [int]$OwnerProcess.ParentProcessId
		} catch {}

		if ($parentId -gt 0) {
			$parent = Get-CimInstance Win32_Process -Filter "ProcessId=$parentId" -ErrorAction SilentlyContinue
			if ($parent -and $parent.Name -match 'powershell' -and $parent.CommandLine -match 'face_launcher\.ps1') {
				$targetId = $parentId
				$targetName = $parent.Name
			}
		}
	}

	Write-Host "[Info] Stopping existing Face backend owner PID: $targetId ($targetName)" -ForegroundColor Yellow
	if (-not (Test-ProcessExists -ProcessId $targetId)) {
		Write-Host "[Info] Target PID $targetId already exited before stop; continuing restart." -ForegroundColor Yellow
		return
	}

	try {
		Stop-Process -Id $targetId -Force -ErrorAction Stop
	} catch {
		if (-not (Test-ProcessExists -ProcessId $targetId)) {
			Write-Host "[Info] Target PID $targetId exited during stop; continuing restart." -ForegroundColor Yellow
			return
		}

		throw
	}
}

if (-not (Ensure-VenvReady)) {
	exit 1
}

if (-not (Ensure-RequiredPackages)) {
	exit 1
}

$candidates = @(
	(Join-Path $iafmDir 'backend\services\face_backend'),
	(Join-Path $iafmDir 'face_backend'),
	(Join-Path $PSScriptRoot 'face_backend')
)

$appDir = $null
foreach ($dir in $candidates) {
	if ((Test-Path (Join-Path $dir 'main.py')) -and (Test-Path (Join-Path $dir 'vision_client.py'))) {
		$appDir = $dir
		break
	}
}

if (-not $appDir) {
	# Fallback search is intentionally scoped to current project root only.
	# This prevents accidentally picking legacy copies under folders like "舊版本".
	$searchRoots = @($iafmDir)
	$found = $null
	foreach ($searchRoot in $searchRoots) {
		$found = Get-ChildItem -Path $searchRoot -Recurse -Filter 'main.py' -File -ErrorAction SilentlyContinue |
		Where-Object {
			$dirName = $_.DirectoryName
			$isFaceBackend = Test-Path (Join-Path $dirName 'vision_client.py')
			$isLegacy = ($dirName -like '*\舊版本\*') -or ($dirName -like '*\手機版本頁面UI測試\*')
			$isFaceBackend -and (-not $isLegacy)
		} |
		Select-Object -First 1
		if ($found) { break }
	}

	if ($found) {
		$appDir = $found.DirectoryName
	}
}

if (-not $appDir) {
	Write-Host '[Error] Cannot find Face backend main.py.' -ForegroundColor Red
	Write-Host "Checked paths:" -ForegroundColor Yellow
	foreach ($dir in $candidates) { Write-Host " - $dir" }
	exit 1
}

Write-Host "[Info] Face backend directory: $appDir" -ForegroundColor Cyan
Set-Location $appDir

$ownerId = Get-ListeningProcessId -Port 8000
if ($ownerId) {
	$owner = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerId" -ErrorAction SilentlyContinue

	if (Test-FaceBackendHealth) {
		if (-not $ForceRestart) {
			Write-Host "[Info] Port 8000 is already in use and Face backend /health is responding." -ForegroundColor Yellow
			Write-Host "[Info] Reusing the existing Face backend instead of starting a duplicate instance." -ForegroundColor Green
			if ($owner) {
				Write-Host "[Info] Owner PID: $ownerId" -ForegroundColor Cyan
				Write-Host "[Info] Owner Name: $($owner.Name)" -ForegroundColor Cyan
			} else {
				Write-Host "[Info] Owner PID: $ownerId" -ForegroundColor Cyan
			}
			exit 0
		}

		Write-Host "[Info] Existing Face backend detected on port 8000. Restarting with a fresh window..." -ForegroundColor Yellow
		try {
			Stop-FaceBackendOwner -OwnerId $ownerId -OwnerProcess $owner
		} catch {
			Write-Host "[Error] Failed to stop the existing Face backend owner." -ForegroundColor Red
			Write-Host "[Info] Error: $($_.Exception.Message)" -ForegroundColor Yellow
			exit 1
		}

		if (-not (Wait-ForPortRelease -Port 8000)) {
			Write-Host "[Error] Port 8000 did not free up after stopping the previous Face backend." -ForegroundColor Red
			exit 1
		}

		Start-Sleep -Milliseconds 400
		$ownerId = $null
	}

	Write-Host "[Error] Port 8000 is already in use, but the current listener did not respond like Face backend." -ForegroundColor Red
	if ($owner) {
		Write-Host "[Info] Owner PID: $ownerId" -ForegroundColor Cyan
		Write-Host "[Info] Owner Name: $($owner.Name)" -ForegroundColor Cyan
		Write-Host "[Info] Owner CMD: $($owner.CommandLine)" -ForegroundColor Cyan
	} else {
		Write-Host "[Info] Owner PID: $ownerId" -ForegroundColor Cyan
	}
	Write-Host "[Fix] Stop the process that currently owns port 8000, or change the Face backend port before retrying." -ForegroundColor Yellow
	exit 1
}

$reloadEnabled = ($env:BACKEND_HOT_RELOAD -eq "1")
if ($reloadEnabled) {
	Write-Host "[Info] Starting Face backend with hot reload enabled." -ForegroundColor Yellow
	& $python -m uvicorn main:app --app-dir $appDir --host 0.0.0.0 --port 8000 --reload
} else {
	Write-Host "[Info] Starting Face backend in stable mode (no hot reload)." -ForegroundColor Green
	& $python -m uvicorn main:app --app-dir $appDir --host 0.0.0.0 --port 8000
}

$exitCode = $LASTEXITCODE
Write-Host "[Info] Face backend process exited with code: $exitCode" -ForegroundColor Yellow
exit $exitCode
