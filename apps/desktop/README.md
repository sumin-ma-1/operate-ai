# Operate AI Desktop

Native window that starts the local **API (`:8000`)** and **web (`:3000`)**, then loads the editor.

## Download

Prebuilt Windows installer: [Releases](https://github.com/sumin-ma-1/operate-ai/releases/latest) → `Operate-AI-windows-setup.exe`  
(Unsigned — SmartScreen may warn.)

## Prerequisites (dev / local package)

- [Rust](https://rustup.rs/) (MSVC toolchain on Windows)
- **Windows:** [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with **Desktop development with C++**
- Node 18+ / pnpm
- `apps/api` Python venv with `requirements.txt` (+ `pyinstaller` for installer builds)

## Dev

From repo root:

```bash
pnpm install
pnpm desktop:dev
```

Uses the monorepo API venv and `next dev`. Closing the window stops processes it started (servers already on `:3000`/`:8000` are left alone).

## Windows installer (bundled API + web)

From repo root:

```bash
apps/api/.venv/Scripts/pip install -r apps/api/requirements.txt pyinstaller
pnpm desktop:build
```

This runs [`packaging/build_windows.ps1`](../../packaging/build_windows.ps1): Next standalone + portable Node, PyInstaller API sidecar, then Tauri NSIS.

Output: `apps/desktop/src-tauri/target/release/bundle/nsis/`.

### Publish a GitHub Release

1. Bump `version` in [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) if needed.
2. Commit, then tag and push:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The [Release workflow](../../.github/workflows/release.yml) builds and uploads `Operate-AI-windows-setup.exe`.
