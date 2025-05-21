use std::path::Path;
use std::fs;
use std::env;
use std::process::Command;

fn main() {
    // Run the tauri build process
    tauri_build::build();
    
    println!("cargo:rerun-if-changed=build.rs");
    
    // Get the output directory
    let out_dir = env::var("OUT_DIR").unwrap();
    let models_dir = Path::new(&out_dir).join("models");
    let indexes_dir = Path::new(&out_dir).join("indexes");
    
    // Create directories
    fs::create_dir_all(&models_dir).expect("Failed to create models directory");
    fs::create_dir_all(&indexes_dir).expect("Failed to create indexes directory");
    
    // Copy the model and index files from the Python directory
    let src_tauri_dir = env::current_dir().unwrap();
    let python_dir = src_tauri_dir.join("python");
    let data_dir = python_dir.join("data").join("embedded_subset");
    
    if data_dir.exists() {
        println!("cargo:warning=Copying model files from Python directory");
        
        // Copy the index files
        let image_index_path = data_dir.join("image_index.faiss");
        let prompt_index_path = data_dir.join("prompt_index.faiss");
        let metadata_path = data_dir.join("prompt_metadata.pkl");
        
        if image_index_path.exists() {
            fs::copy(&image_index_path, indexes_dir.join("image_index.faiss"))
                .expect("Failed to copy image index");
            println!("cargo:warning=Copied image index");
        } else {
            println!("cargo:warning=Image index file not found at {:?}", image_index_path);
        }
        
        if prompt_index_path.exists() {
            fs::copy(&prompt_index_path, indexes_dir.join("prompt_index.faiss"))
                .expect("Failed to copy prompt index");
            println!("cargo:warning=Copied prompt index");
        } else {
            println!("cargo:warning=Prompt index file not found at {:?}", prompt_index_path);
        }
        
        if metadata_path.exists() {
            fs::copy(&metadata_path, indexes_dir.join("prompt_metadata.pkl"))
                .expect("Failed to copy metadata");
            println!("cargo:warning=Copied metadata");
        } else {
            println!("cargo:warning=Metadata file not found at {:?}", metadata_path);
        }
    } else {
        println!("cargo:warning=Python data directory not found at {:?}", data_dir);
    }
    
    // Add the output directory to the search path
    println!("cargo:rustc-env=MODELS_DIR={}", models_dir.display());
    println!("cargo:rustc-env=INDEXES_DIR={}", indexes_dir.display());
}
