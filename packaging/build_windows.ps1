#requires -Version 5.1
<#
.SYNOPSIS
  Build Operate AI Windows desktop NSIS installer with bundled API + web.

.DESCRIPTION
  1. Build shared schema + Next web
  2. pnpm deploy web + copy .next/public + portable node.exe → resources/sidecar/web
  3. PyInstaller-bundle the API → resources/sidecar/api
  4. tauri build --bundles nsis

  Prerequisites: Rust (MSVC), Node/pnpm, Python venv at apps/api/.venv with
  requirements + pyinstaller installed.
#>
[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $Here
$Desktop = Join-Path $Root "apps\desktop"
$SrcTauri = Join-Path $Desktop "src-tauri"
$Resources = Join-Path $SrcTauri "resources\sidecar"
$ApiVenv = Join-Path $Root "apps\api\.venv"
$PyInstaller = Join-Path $ApiVenv "Scripts\pyinstaller.exe"
$NodeVersion = "v22.14.0"

function Require-Cmd($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required tool '$name' not found on PATH."
  }
}

Require-Cmd rustc
Require-Cmd pnpm
Require-Cmd cargo
if (-not (Test-Path $PyInstaller)) {
  throw "PyInstaller not found at $PyInstaller. Run: apps/api/.venv/Scripts/pip install pyinstaller"
}

Push-Location $Root
try {
  Write-Host "==> [1/4] schema + web" -ForegroundColor Cyan
  pnpm build:schema
  if ($LASTEXITCODE -ne 0) { throw "build:schema failed" }
  pnpm build:web
  if ($LASTEXITCODE -ne 0) { throw "build:web failed" }

  $nextDir = Join-Path $Root "apps\web\.next"
  if (-not (Test-Path $nextDir)) {
    throw "Next build output missing at $nextDir"
  }

  Write-Host "==> [2/4] stage web sidecar zip (pnpm deploy + node.exe)" -ForegroundColor Cyan
  if (Test-Path $Resources) {
    cmd /c "rmdir /s /q `"$Resources`""
    if (Test-Path $Resources) { throw "Failed to clear $Resources" }
  }
  New-Item -ItemType Directory -Force -Path $Resources | Out-Null

  # Stage under a short TEMP path (Windows MAX_PATH / NSIS limits).
  $webStage = Join-Path $env:TEMP "oai-ws"
  if (Test-Path $webStage) { cmd /c "rmdir /s /q `"$webStage`"" }
  New-Item -ItemType Directory -Force -Path $webStage | Out-Null

  $deployTmp = Join-Path $env:TEMP "oai-wd"
  if (Test-Path $deployTmp) { cmd /c "rmdir /s /q `"$deployTmp`"" }
  New-Item -ItemType Directory -Force -Path $deployTmp | Out-Null

  pnpm --filter=@operate-ai/web deploy --prod --legacy $deployTmp
  if ($LASTEXITCODE -ne 0) { throw "pnpm deploy failed" }

  cmd /c "robocopy `"$deployTmp`" `"$webStage`" /E /NFL /NDL /NJH /NJS /nc /ns /np"
  if ($LASTEXITCODE -ge 8) { throw "robocopy deploy→stage failed ($LASTEXITCODE)" }
  Copy-Item -Recurse -Force $nextDir (Join-Path $webStage ".next")
  $publicSrc = Join-Path $Root "apps\web\public"
  if (Test-Path $publicSrc) {
    Copy-Item -Recurse -Force $publicSrc (Join-Path $webStage "public")
  }

  # Drop type/map junk that only deepens paths for the installer.
  Get-ChildItem -LiteralPath $webStage -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -in ".map", ".ts", ".mts", ".cts" -or $_.Name -like "*.d.ts" } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }

  $nextBin = Join-Path $webStage "node_modules\next\dist\bin\next"
  if (-not (Test-Path $nextBin)) {
    throw "next binary missing after deploy under $webStage"
  }

  $cache = Join-Path $Here ".cache"
  New-Item -ItemType Directory -Force -Path $cache | Out-Null
  $nodeZip = Join-Path $cache "node-$NodeVersion-win-x64.zip"
  $nodeUrl = "https://nodejs.org/dist/$NodeVersion/node-$NodeVersion-win-x64.zip"
  if (-not (Test-Path $nodeZip)) {
    Write-Host " downloading $nodeUrl"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeZip
  }
  $nodeExtract = Join-Path $cache "node-$NodeVersion-win-x64"
  if (-not (Test-Path (Join-Path $nodeExtract "node.exe"))) {
    if (Test-Path $nodeExtract) { Remove-Item -Recurse -Force $nodeExtract }
    Expand-Archive -Path $nodeZip -DestinationPath $cache -Force
  }
  Copy-Item -Force (Join-Path $nodeExtract "node.exe") (Join-Path $webStage "node.exe")

  $webZip = Join-Path $Resources "web.zip"
  if (Test-Path $webZip) { Remove-Item -Force $webZip }
  Write-Host " compressing web sidecar → web.zip"
  Push-Location $webStage
  try {
    & tar -a -cf $webZip *
    if ($LASTEXITCODE -ne 0) { throw "tar zip failed (exit $LASTEXITCODE)" }
  } finally {
    Pop-Location
  }
  if (-not (Test-Path $webZip)) { throw "web.zip missing after compress" }

  Write-Host "==> [3/4] PyInstaller API sidecar" -ForegroundColor Cyan
  $running = Get-Process -Name "operate-ai-api" -ErrorAction SilentlyContinue
  if ($running) {
    Write-Host " stopping running operate-ai-api process(es)"
    $running | Stop-Process -Force
    Start-Sleep -Seconds 1
  }
  $dist = Join-Path $Here "dist"
  $work = Join-Path $Here "build"
  & $PyInstaller --noconfirm --clean `
    --distpath $dist --workpath $work `
    (Join-Path $Here "operate-ai-api.spec")
  if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed (exit $LASTEXITCODE)" }

  $apiSrc = Join-Path $dist "operate-ai-api"
  $apiDst = Join-Path $Resources "api"
  New-Item -ItemType Directory -Force -Path $apiDst | Out-Null
  Copy-Item -Recurse -Force (Join-Path $apiSrc "*") $apiDst
  if (-not (Test-Path (Join-Path $apiDst "operate-ai-api.exe"))) {
    throw "operate-ai-api.exe missing after PyInstaller stage"
  }

  Write-Host "==> [4/4] tauri build (nsis)" -ForegroundColor Cyan
  Push-Location $Desktop
  try {
    pnpm exec tauri build --bundles nsis
    if ($LASTEXITCODE -ne 0) { throw "tauri build failed (exit $LASTEXITCODE)" }
  } finally {
    Pop-Location
  }

  $bundle = Join-Path $SrcTauri "target\release\bundle\nsis"
  Write-Host ""
  Write-Host "Done. NSIS under: $bundle" -ForegroundColor Green
  Get-ChildItem -Path $bundle -Filter "*.exe" -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host " $($_.FullName)" }
} finally {
  Pop-Location
}
