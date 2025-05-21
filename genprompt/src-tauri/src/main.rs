// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use std::path::{Path, PathBuf};
use std::net::TcpStream;
use std::io::{self, ErrorKind};
use tauri::{AppHandle, Manager, Emitter};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
struct PythonProcessStatus {
    running: bool,
    port: u16,
    error: Option<String>,
}

// Function to check if Python is installed
fn check_python_installed() -> bool {
    let python_cmd = if cfg!(target_os = "windows") {
        "python --version"
    } else {
        "python3 --version"
    };
    
    match Command::new("sh").arg("-c").arg(python_cmd).output() {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

// Helper function to get app directory
fn get_app_dir(app_handle: &AppHandle) -> Option<PathBuf> {
    app_handle.path().app_data_dir().ok()
}

// Helper function to check if a port is open/listening
fn is_port_open(host: &str, port: u16) -> bool {
    match TcpStream::connect(format!("{}:{}", host, port)) {
        Ok(_) => true,
        Err(ref e) if e.kind() == ErrorKind::ConnectionRefused => false,
        Err(_) => false,
    }
}

// Helper function to wait for a port to be open
fn wait_for_port(host: &str, port: u16, timeout_secs: u64) -> io::Result<()> {
    let timeout = Duration::from_secs(timeout_secs);
    let start_time = Instant::now();
    
    while start_time.elapsed() < timeout {
        if is_port_open(host, port) {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(100));
    }
    
    Err(io::Error::new(
        ErrorKind::TimedOut,
        format!("Timed out waiting for {}:{} to be available", host, port),
    ))
}

fn main() {
    let python_status = Arc::new(Mutex::new(PythonProcessStatus {
        running: false,
        port: 5001,
        error: None,
    }));

    let ps = python_status.clone();

    tauri::Builder::default()
        .setup(move |app| {
            let app_handle = app.handle().clone();

            thread::spawn(move || {
                // Check if Python is installed
                if !check_python_installed() {
                    let mut status = ps.lock().unwrap();
                    status.running = false;
                    status.error = Some("Python is not installed or not in PATH. Please install Python and try again.".to_string());
                    app_handle.emit("python-backend-error", &*status).unwrap();
                    return;
                }
                
                // Get the resource path - different in dev vs production
                let python_script_path = if cfg!(debug_assertions) {
                    // In development, use the path relative to the project root
                    let dev_path = "python/server.py";
                    
                    // Check if the development path exists
                    if !Path::new(dev_path).exists() {
                        let mut status = ps.lock().unwrap();
                        status.error = Some(format!("Python script not found at development path: {}", dev_path));
                        app_handle.emit("python-backend-error", &*status).unwrap();
                        return;
                    }
                    
                    dev_path.to_string()
                } else {
                    // In production, use the packaged python directory
                    let app_dir = match get_app_dir(&app_handle) {
                        Some(path) => path,
                        None => {
                            let mut status = ps.lock().unwrap();
                            status.error = Some("Could not resolve app directory".to_string());
                            app_handle.emit("python-backend-error", &*status).unwrap();
                            return;
                        }
                    };
                    
                    let script_path = app_dir.join("python/server.py");
                    if !script_path.exists() {
                        let mut status = ps.lock().unwrap();
                        status.error = Some(format!("Python script not found at: {}", script_path.display()));
                        app_handle.emit("python-backend-error", &*status).unwrap();
                        return;
                    }
                    
                    script_path.to_string_lossy().into_owned()
                };
                
                println!("Starting Python backend using: {}", python_script_path);
                
                let mut command = if cfg!(target_os = "windows") {
                    Command::new("python")
                } else {
                    Command::new("python3")
                };
                
                let port = 5001;
                let process = command
                    .arg(&python_script_path)
                    .spawn();
                
                match process {
                    Ok(_) => {
                        // Wait for the port to be open to ensure server is ready
                        println!("Waiting for Python server to start on port {}...", port);
                        match wait_for_port("127.0.0.1", port, 30) {
                            Ok(_) => {
                                let mut status = ps.lock().unwrap();
                                status.running = true;
                                status.port = port;
                                println!("Python backend is now running on port {}", port);
                                
                                // Emit event to frontend that backend is ready
                                app_handle.emit("python-backend-ready", &*status).unwrap();
                            },
                            Err(e) => {
                                let mut status = ps.lock().unwrap();
                                status.running = false;
                                status.error = Some(format!("Python server didn't start properly: {}", e));
                                println!("Failed to connect to Python server: {}", e);
                                
                                // Emit error event
                                app_handle.emit("python-backend-error", &*status).unwrap();
                            }
                        }
                    },
                    Err(e) => {
                        let mut status = ps.lock().unwrap();
                        status.running = false;
                        status.error = Some(e.to_string());
                        println!("Failed to start Python backend: {}", e);
                        
                        // Emit error event
                        app_handle.emit("python-backend-error", &*status).unwrap();
                    }
                }
            });
            
            Ok(())
        })
        .manage(python_status)
        .invoke_handler(tauri::generate_handler![get_backend_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_backend_status(state: tauri::State<Arc<Mutex<PythonProcessStatus>>>) -> PythonProcessStatus {
    state.lock().unwrap().clone()
}
