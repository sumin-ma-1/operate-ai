// Operate AI desktop shell: start local API + web, then open them in the window.
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Manager, RunEvent, Url, WindowEvent};

struct ServerState {
    children: Mutex<Vec<Child>>,
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.."))
}

fn port_open(port: u16) -> bool {
    TcpStream::connect(("127.0.0.1", port)).is_ok()
}

fn wait_for_port(port: u16, timeout: Duration) -> bool {
    let start = std::time::Instant::now();
    while start.elapsed() < timeout {
        if port_open(port) {
            return true;
        }
        thread::sleep(Duration::from_millis(400));
    }
    false
}

/// Best-effort: free a local port so a stale/broken Next process cannot block re-extract.
fn kill_port_listeners(port: u16) {
    #[cfg(windows)]
    {
        let _ = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    "Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue | \
                     ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}"
                ),
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = Command::new("sh")
            .args([
                "-c",
                &format!("lsof -ti tcp:{port} | xargs -r kill -9"),
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    // Give the OS a moment to release file locks under %LOCALAPPDATA%\OperateAI\web.
    thread::sleep(Duration::from_millis(500));
}

#[cfg(windows)]
fn apply_no_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn apply_no_window(_cmd: &mut Command) {}

fn local_data_dir() -> PathBuf {
    if let Ok(base) = std::env::var("LOCALAPPDATA") {
        return PathBuf::from(base).join("OperateAI");
    }
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join(".operate-ai");
    }
    PathBuf::from("operate-ai-data")
}

const WEB_BUNDLE_MARKER: &str = "0.1.5";

fn web_bundle_complete(dir: &Path) -> bool {
    dir.join("node.exe").exists()
        && dir.join("package.json").exists()
        && dir.join("node_modules/next/dist/bin/next").exists()
        && (dir.join(".next/static").is_dir() || dir.join("server.js").exists())
}

fn ensure_web_dir(sidecar: &Path) -> Result<PathBuf, String> {
    let dest = local_data_dir().join("web");
    let marker = dest.join(".bundle-ok");
    let marker_ok = std::fs::read_to_string(&marker)
        .map(|s| s.trim() == WEB_BUNDLE_MARKER)
        .unwrap_or(false);
    if marker_ok && web_bundle_complete(&dest) {
        return Ok(dest);
    }

    let zip = sidecar.join("web.zip");
    if !zip.exists() {
        // Dev-style layout: unzipped web folder next to api.
        let loose = sidecar.join("web");
        if web_bundle_complete(&loose) {
            return Ok(loose);
        }
        return Err(format!("Bundled web.zip not found at {}", zip.display()));
    }

    // Incomplete caches are often still "serving" on :3000 and lock files on Windows.
    kill_port_listeners(3000);
    if dest.exists() {
        let _ = std::fs::remove_dir_all(&dest);
    }
    std::fs::create_dir_all(&dest).map_err(|e| format!("create web dir: {e}"))?;

    let output = Command::new("tar")
        .args([
            "-xf",
            zip.to_str().ok_or("web.zip path is not valid UTF-8")?,
            "-C",
            dest.to_str().ok_or("web dest path is not valid UTF-8")?,
        ])
        .output()
        .map_err(|e| format!("Failed to extract web.zip (is tar available?): {e}"))?;
    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        let hint = err.lines().next().unwrap_or("unknown tar error");
        let _ = std::fs::remove_dir_all(&dest);
        return Err(format!("tar failed to extract web.zip — {hint}"));
    }
    if !web_bundle_complete(&dest) {
        let _ = std::fs::remove_dir_all(&dest);
        return Err(
            "web.zip extracted but bundle is incomplete (missing Next/static assets)".into(),
        );
    }

    std::fs::write(&marker, WEB_BUNDLE_MARKER.as_bytes())
        .map_err(|e| format!("write web marker: {e}"))?;
    Ok(dest)
}

fn resource_sidecar(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("resource dir: {e}"))?;
    Ok(resource_dir.join("sidecar"))
}

fn spawn_api_dev(root: &Path) -> Result<Child, String> {
    let python = if cfg!(windows) {
        root.join("apps/api/.venv/Scripts/python.exe")
    } else {
        root.join("apps/api/.venv/bin/python")
    };
    if !python.exists() {
        return Err(format!(
            "API Python venv not found at {}. Create it under apps/api first.",
            python.display()
        ));
    }

    let mut cmd = Command::new(&python);
    cmd.args([
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
    ])
    .current_dir(root.join("apps/api"))
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null());
    apply_no_window(&mut cmd);
    cmd.spawn()
        .map_err(|e| format!("Failed to start API: {e}"))
}

fn spawn_web_dev(root: &Path) -> Result<Child, String> {
    let mut cmd = if cfg!(windows) {
        let mut c = Command::new("cmd");
        c.arg("/C");
        c.args([
            "pnpm",
            "--filter",
            "@operate-ai/web",
            "exec",
            "next",
            "dev",
            "--port",
            "3000",
        ]);
        c
    } else {
        let mut c = Command::new("pnpm");
        c.args([
            "--filter",
            "@operate-ai/web",
            "exec",
            "next",
            "dev",
            "--port",
            "3000",
        ]);
        c
    };

    cmd.current_dir(root)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    apply_no_window(&mut cmd);
    cmd.spawn()
        .map_err(|e| format!("Failed to start web (is pnpm on PATH?): {e}"))
}

fn spawn_api_release(sidecar: &Path) -> Result<Child, String> {
    let exe = sidecar.join("api").join("operate-ai-api.exe");
    if !exe.exists() {
        return Err(format!("Bundled API not found at {}", exe.display()));
    }
    let data = local_data_dir();
    let _ = std::fs::create_dir_all(&data);

    let mut cmd = Command::new(&exe);
    cmd.env("OPERATE_AI_DATA", &data)
        .env("PORT", "8000")
        .current_dir(exe.parent().unwrap_or(sidecar))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    apply_no_window(&mut cmd);
    cmd.spawn()
        .map_err(|e| format!("Failed to start bundled API: {e}"))
}

fn spawn_web_release(sidecar: &Path) -> Result<Child, String> {
    let web_dir = ensure_web_dir(sidecar)?;
    let node = web_dir.join("node.exe");
    if !node.exists() {
        return Err(format!("Bundled Node not found at {}", node.display()));
    }

    let log_dir = local_data_dir();
    let _ = std::fs::create_dir_all(&log_dir);
    let stdout_log = std::fs::File::create(log_dir.join("web-stdout.log")).ok();
    let stderr_log = std::fs::File::create(log_dir.join("web-stderr.log")).ok();

    // Prefer Next standalone server.js when present; otherwise `next start` from pnpm deploy.
    let standalone = web_dir.join("server.js");
    let mut cmd = Command::new(&node);
    if standalone.exists() {
        cmd.arg("server.js");
    } else {
        let next_bin = web_dir.join("node_modules/next/dist/bin/next");
        if !next_bin.exists() {
            return Err(format!(
                "Bundled Next not found at {} (and no server.js)",
                next_bin.display()
            ));
        }
        cmd.arg(next_bin)
            .args(["start", "--hostname", "127.0.0.1", "--port", "3000"]);
    }

    cmd.current_dir(&web_dir)
        .env("PORT", "3000")
        .env("HOSTNAME", "127.0.0.1")
        .stdin(Stdio::null())
        .stdout(stdout_log.map(Stdio::from).unwrap_or_else(Stdio::null))
        .stderr(stderr_log.map(Stdio::from).unwrap_or_else(Stdio::null));
    apply_no_window(&mut cmd);
    cmd.spawn()
        .map_err(|e| format!("Failed to start bundled web: {e}"))
}

fn kill_child(child: &mut Child) {
    let pid = child.id();
    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn shutdown_servers(state: &ServerState) {
    if let Ok(mut children) = state.children.lock() {
        for child in children.iter_mut() {
            kill_child(child);
        }
        children.clear();
    }
}

fn start_servers(app: &AppHandle, state: &ServerState) -> Result<(), String> {
    // In release, never trust an already-open :3000 unless the on-disk web bundle is complete
    // (a half-extracted / wiped cache looks unstyled or "weird").
    if cfg!(not(debug_assertions)) {
        let sidecar = resource_sidecar(app)?;
        let web_dir = ensure_web_dir(&sidecar)?;
        if port_open(8000) && port_open(3000) && web_bundle_complete(&web_dir) {
            return Ok(());
        }
    } else if port_open(8000) && port_open(3000) {
        return Ok(());
    }

    let mut kids = state
        .children
        .lock()
        .map_err(|_| "server state lock poisoned".to_string())?;

    if cfg!(debug_assertions) {
        let root = repo_root();
        if !port_open(8000) {
            kids.push(spawn_api_dev(&root)?);
        }
        if !port_open(3000) {
            kids.push(spawn_web_dev(&root)?);
        }
    } else {
        let sidecar = resource_sidecar(app)?;
        if !port_open(8000) {
            kids.push(spawn_api_release(&sidecar)?);
        }
        if !port_open(3000) {
            kids.push(spawn_web_release(&sidecar)?);
        }
    }
    drop(kids);

    if !wait_for_port(8000, Duration::from_secs(45)) {
        return Err("API did not become ready on :8000".into());
    }
    if !wait_for_port(3000, Duration::from_secs(90)) {
        let hint = std::fs::read_to_string(local_data_dir().join("web-stderr.log"))
            .ok()
            .map(|s| {
                s.lines()
                    .rev()
                    .find(|l| !l.trim().is_empty())
                    .unwrap_or("")
                    .chars()
                    .take(160)
                    .collect::<String>()
            })
            .filter(|s| !s.is_empty())
            .map(|s| format!(" — {s}"))
            .unwrap_or_default();
        return Err(format!("Web did not become ready on :3000{hint}"));
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = ServerState {
        children: Mutex::new(Vec::new()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .setup(|app| {
            let handle = app.handle().clone();
            thread::spawn(move || {
                let state = handle.state::<ServerState>();
                let result = start_servers(&handle, &state);
                if let Some(window) = handle.get_webview_window("main") {
                    match result {
                        Ok(()) => {
                            if let Ok(url) = Url::parse("http://127.0.0.1:3000/") {
                                let _ = window.navigate(url);
                            }
                        }
                        Err(err) => {
                            let safe = err
                                .replace('\\', "\\\\")
                                .replace('\'', "\\'")
                                .replace('\n', " ");
                            let _ = window.eval(&format!(
                                "document.body.classList.add('is-error');\
                                 document.getElementById('status').textContent = 'Failed: {safe}'"
                            ));
                        }
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                let state = window.app_handle().state::<ServerState>();
                shutdown_servers(&state);
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Operate AI desktop")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                let state = app_handle.state::<ServerState>();
                shutdown_servers(&state);
            }
        });
}
