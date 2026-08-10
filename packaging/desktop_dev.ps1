#requires -Version 5.1
# Ensure cargo/pnpm are on PATH (Cursor terminals often miss User PATH), then run tauri dev.
$ErrorActionPreference = "Stop"

$machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
$user = [Environment]::GetEnvironmentVariable("Path", "User")
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
$env:Path = (@($cargoBin, $machine, $user, $env:Path) | Where-Object { $_ }) -join ";"

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  throw "cargo not found. Install Rust from https://rustup.rs and reopen the terminal."
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  throw "pnpm not found. Install Node.js/pnpm and reopen the terminal."
}

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $Here
Set-Location $Root
pnpm --filter @operate-ai/desktop desktop:dev
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
