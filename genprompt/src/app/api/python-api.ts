// Python API via Tauri
import { isTauri } from "./tauri-api";

export interface PythonStatus {
  initialized: boolean;
  error: string | null;
}

export interface SearchResult {
  similarity: number;
  image_name: string;
  prompt: string;
  seed?: number;
  cfg?: number;
  steps?: number;
  sampler?: string;
}

export interface SearchResponse {
  success: boolean;
  image_matches?: SearchResult[];
  prompt_matches?: SearchResult[];
  error?: string;
}

export async function getPythonStatus(): Promise<PythonStatus> {
  if (!isTauri()) {
    return { initialized: true, error: null }; // Mock for non-Tauri environments
  }

  try {
    return await window.__TAURI__!.invoke<PythonStatus>("get_python_status");
  } catch (error) {
    console.error("Error getting Python status:", error);
    return { initialized: false, error: String(error) };
  }
}

export async function setupPythonListeners(
  onReady: () => void,
  onError: (error: string) => void
): Promise<void> {
  if (!isTauri()) return;

  // Listen for Python ready event
  window.__TAURI__!.event.listen("python-ready", (event) => {
    console.log("Python initialized successfully", event);
    onReady();
  });

  // Listen for Python error event
  window.__TAURI__!.event.listen("python-error", (event: any) => {
    console.error("Python initialization error:", event);
    const errorMessage =
      event.payload?.error ||
      event.payload ||
      "Unknown error initializing Python";

    onError(
      typeof errorMessage === "string"
        ? errorMessage
        : JSON.stringify(errorMessage)
    );
  });
}

export async function searchImageFromFile(file: File): Promise<SearchResponse> {
  if (!isTauri()) {
    // Mock response for non-Tauri environments
    return {
      success: true,
      image_matches: [],
      prompt_matches: [],
    };
  }

  try {
    // Convert file to byte array
    const arrayBuffer = await file.arrayBuffer();
    const byteArray = new Uint8Array(arrayBuffer);

    // Call the Tauri command
    return await window.__TAURI__!.invoke<SearchResponse>(
      "search_image_bytes",
      {
        image_bytes: Array.from(byteArray),
      }
    );
  } catch (error) {
    console.error("Error searching image:", error);
    return {
      success: false,
      error: String(error),
    };
  }
}
