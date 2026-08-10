#requires -Version 5.1
<#
.SYNOPSIS
  Build Operate AI Windows desktop NSIS installer with bundled API + web.

.DESCRIPTION
  1. Build shared schema + Next web
  2. pnpm deploy web, hoist .pnpm deps, copy .next/public + portable node.exe → web.zip
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
  $builtRuntime = Join-Path $nextDir "server\webpack-runtime.js"
  if (-not (Test-Path $builtRuntime)) {
    throw "Next build missing server/webpack-runtime.js"
  }
  if ((Get-Content -LiteralPath $builtRuntime -Raw) -notmatch 'chunks/') {
    throw "Next build webpack-runtime.js is corrupt (no chunks/ path) — free disk and rebuild"
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

  # pnpm deploy keeps transitive deps under node_modules/.pnpm only. Next's
  # require-hook resolves packages like styled-jsx from the project root, so
  # hoist every package from the virtual store to top-level node_modules.
  $deployNm = Join-Path $deployTmp "node_modules"
  $deployPnpm = Join-Path $deployNm ".pnpm"
  if (Test-Path $deployPnpm) {
    Write-Host " hoisting pnpm virtual store → top-level node_modules"
    Get-ChildItem -LiteralPath $deployPnpm -Directory | ForEach-Object {
      $inner = Join-Path $_.FullName "node_modules"
      if (-not (Test-Path -LiteralPath $inner)) { return }
      Get-ChildItem -LiteralPath $inner -Force | ForEach-Object {
        if ($_.Name -eq ".bin") { return }
        if ($_.Name.StartsWith("@")) {
          $scope = $_.Name
          Get-ChildItem -LiteralPath $_.FullName -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $dest = Join-Path $deployNm (Join-Path $scope $_.Name)
            if (-not (Test-Path -LiteralPath $dest)) {
              New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
              cmd /c "robocopy `"$($_.FullName)`" `"$dest`" /E /NFL /NDL /NJH /NJS /nc /ns /np" | Out-Null
            }
          }
        } else {
          $dest = Join-Path $deployNm $_.Name
          if (-not (Test-Path -LiteralPath $dest)) {
            cmd /c "robocopy `"$($_.FullName)`" `"$dest`" /E /NFL /NDL /NJH /NJS /nc /ns /np" | Out-Null
          }
        }
      }
    }
  }

  # Drop Next build cache from deploy copy (huge, not needed at runtime).
  $deployCache = Join-Path $deployTmp ".next\cache"
  if (Test-Path $deployCache) {
    cmd /c "rmdir /s /q `"$deployCache`""
  }

  # Never copy deploy's .next — it can be incomplete; we stage a fresh build below.
  cmd /c "robocopy `"$deployTmp`" `"$webStage`" /E /XD cache .next /NFL /NDL /NJH /NJS /nc /ns /np"
  if ($LASTEXITCODE -ge 8) { throw "robocopy deploy→stage failed ($LASTEXITCODE)" }

  # Always use the freshly built .next (avoid nested .next/.next from Copy-Item).
  $nextDst = Join-Path $webStage ".next"
  if (Test-Path $nextDst) { cmd /c "rmdir /s /q `"$nextDst`"" }
  New-Item -ItemType Directory -Force -Path $nextDst | Out-Null
  cmd /c "robocopy `"$nextDir`" `"$nextDst`" /E /XD cache /NFL /NDL /NJH /NJS /nc /ns /np"
  if ($LASTEXITCODE -ge 8) { throw "robocopy .next→stage failed ($LASTEXITCODE)" }

  $publicSrc = Join-Path $Root "apps\web\public"
  if (Test-Path $publicSrc) {
    $publicDst = Join-Path $webStage "public"
    if (Test-Path $publicDst) { cmd /c "rmdir /s /q `"$publicDst`"" }
    Copy-Item -Recurse -Force $publicSrc $publicDst
  }

  # Runtime must not load next.config.ts (Next would try to install TypeScript via pnpm).
  $cfgTs = Join-Path $webStage "next.config.ts"
  if (Test-Path $cfgTs) { Remove-Item -Force $cfgTs }
  if (-not (Test-Path (Join-Path $webStage "next.config.mjs")) -and
      -not (Test-Path (Join-Path $webStage "next.config.js"))) {
    throw "staged web is missing next.config.mjs/js — next start would fail without TypeScript"
  }
  # Drop pnpm virtual-store metadata so Next never tries `pnpm add` against a Temp path.
  foreach ($pnpmMeta in @(".modules.yaml", "pnpm-lock.yaml", "pnpm-workspace.yaml")) {
    $p = Join-Path $webStage $pnpmMeta
    if (Test-Path $p) { Remove-Item -Force $p }
  }

  # Drop type/map junk from node_modules only (never touch .next).
  $stageNm = Join-Path $webStage "node_modules"
  if (Test-Path $stageNm) {
    Get-ChildItem -LiteralPath $stageNm -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.Extension -in ".map", ".ts", ".mts", ".cts" -or $_.Name -like "*.d.ts" } |
      ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue }
  }

  $nextBin = Join-Path $webStage "node_modules\next\dist\bin\next"
  if (-not (Test-Path $nextBin)) {
    throw "next binary missing after deploy under $webStage"
  }
  $styledJsx = Join-Path $webStage "node_modules\styled-jsx\package.json"
  if (-not (Test-Path $styledJsx)) {
    throw "styled-jsx missing after hoist — Next will fail to start"
  }
  $webpackRuntime = Join-Path $webStage ".next\server\webpack-runtime.js"
  if (-not (Test-Path $webpackRuntime)) {
    throw "webpack-runtime.js missing under staged .next"
  }
  $runtimeText = Get-Content -LiteralPath $webpackRuntime -Raw
  if ($runtimeText -notmatch 'chunks/') {
    throw "staged webpack-runtime.js looks corrupt (no chunks/ path) — rebuild web and retry"
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
    # GitHub Actions sets CI=true; pnpm may then drop desktop devDependencies
    # (@tauri-apps/cli). Force a full install and clear CI for this step.
    Remove-Item Env:CI -ErrorAction SilentlyContinue
    $env:CI = "false"
    pnpm install --prod=false --filter @operate-ai/desktop... --config.confirmModulesPurge=false
    if ($LASTEXITCODE -ne 0) { throw "desktop deps install failed" }
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
