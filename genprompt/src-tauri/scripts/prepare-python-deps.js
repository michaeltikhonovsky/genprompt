/**
 * Script to prepare Python dependencies for Tauri packaging
 * This script copies the necessary Python files and dependencies
 * into the Tauri src-tauri/python directory
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Define paths
const rootDir = path.resolve(__dirname, "../../..");
const backendDir = path.join(rootDir, "backend");
const pythonDestDir = path.join(__dirname, "..", "python");

// Create the python directory if it doesn't exist
if (!fs.existsSync(pythonDestDir)) {
  fs.mkdirSync(pythonDestDir, { recursive: true });
}

// Copy Python backend files
const pythonFiles = ["server.py", "search.py", "requirements.txt"];
for (const file of pythonFiles) {
  const sourcePath = path.join(backendDir, file);

  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, path.join(pythonDestDir, file));
    console.log(`Copied ${file} to ${pythonDestDir}`);
  } else {
    console.warn(`Warning: ${file} not found in backend directory`);
  }
}

// Copy data directory (models, indexes, etc.)
const dataDir = path.join(backendDir, "data");
const dataDestDir = path.join(pythonDestDir, "data");

if (!fs.existsSync(dataDestDir)) {
  fs.mkdirSync(dataDestDir, { recursive: true });
}

// Ensure there's at least one file in the data directory to satisfy the resource path
const placeholderPath = path.join(dataDestDir, "placeholder.json");
if (!fs.existsSync(placeholderPath)) {
  fs.writeFileSync(
    placeholderPath,
    JSON.stringify({ info: "Placeholder file for Tauri packaging" })
  );
  console.log(`Created placeholder file in ${dataDestDir}`);
}

if (fs.existsSync(dataDir)) {
  // Copy subdirectories first (like embedded_subset)
  const copyDirRecursive = (src, dest) => {
    // Create the destination directory if it doesn't exist
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    // Read all items in the source directory
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // Recursively copy subdirectory
        copyDirRecursive(srcPath, destPath);
        console.log(`Copied directory ${srcPath} to ${destPath}`);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".index") ||
          entry.name.endsWith(".npy") ||
          entry.name.endsWith(".json") ||
          entry.name.endsWith(".faiss") ||
          entry.name.endsWith(".pkl"))
      ) {
        // Copy file if it matches our extensions
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied ${srcPath} to ${destPath}`);
      }
    }
  };

  // Start the recursive copy
  copyDirRecursive(dataDir, dataDestDir);
} else {
  console.warn(`Warning: data directory not found at ${dataDir}`);
}

console.log("Python dependencies prepared for packaging");

// Update the path in server.py to use relative paths
let serverPath = path.join(pythonDestDir, "server.py");
if (fs.existsSync(serverPath)) {
  let serverContent = fs.readFileSync(serverPath, "utf8");
  serverContent = serverContent.replace(
    "SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))",
    "SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))"
  );
  fs.writeFileSync(serverPath, serverContent);
  console.log("Updated paths in server.py");
}
