/**
 * API utilities specific to Tauri app environment
 */

// TypeScript interface for Tauri window object
declare global {
  interface Window {
    __TAURI__?: {
      event: {
        listen: (
          event: string,
          callback: (event: any) => void
        ) => Promise<() => void>;
      };
      invoke: <T>(command: string, args?: any) => Promise<T>;
      fs: {
        exists: (path: string) => Promise<boolean>;
      };
      path: {
        appDir: () => Promise<string>;
      };
    };
  }
}

// Check if we're running in a Tauri environment
export function isTauri(): boolean {
  return Boolean(
    typeof window !== "undefined" && window.__TAURI__ !== undefined
  );
}

// Check if a directory exists in Tauri
export async function directoryExists(path: string): Promise<boolean> {
  if (!isTauri()) return false;

  try {
    const fs = window.__TAURI__!.fs;
    await fs.exists(path);
    return true;
  } catch (error) {
    console.error(`Error checking if directory exists: ${path}`, error);
    return false;
  }
}

// Get the app directory path
export async function getAppDir(): Promise<string | null> {
  if (!isTauri()) return null;

  try {
    const path = window.__TAURI__!.path;
    return await path.appDir();
  } catch (error) {
    console.error("Error getting app directory", error);
    return null;
  }
}

export const getApiBaseUrl = () => {
  // For non-Tauri environments, use the API URL
  return process.env.NEXT_PUBLIC_API_URL || "/api";
};

// Function to handle uploads in Tauri context
export async function uploadImage(file: File) {
  if (isTauri()) {
    try {
      // Convert file to array buffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Call the Tauri command
      const result = await window.__TAURI__!.invoke("analyze_image", {
        imageData: Array.from(uint8Array),
      });

      return result;
    } catch (error) {
      console.error("Error analyzing image:", error);
      throw error;
    }
  } else {
    // For non-Tauri environments, use the HTTP API
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`${getApiBaseUrl()}/api/upload`, {
      method: "POST",
      body: formData,
    });

    return response.json();
  }
}

// Function to handle search in Tauri context
export async function searchImage(file: File) {
  if (isTauri()) {
    // Use uploadImage since it does the same thing in Tauri context
    return uploadImage(file);
  } else {
    // For non-Tauri environments, use the HTTP API
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`${getApiBaseUrl()}/api/search`, {
      method: "POST",
      body: formData,
    });

    return response.json();
  }
}

// When using embedding for search
export async function searchWithEmbedding(embedding: number[]) {
  if (isTauri()) {
    try {
      // Call the Tauri command
      const result = await window.__TAURI__!.invoke("search_with_embedding", {
        embedding,
      });

      return result;
    } catch (error) {
      console.error("Error searching with embedding:", error);
      throw error;
    }
  } else {
    // For non-Tauri environments, use the HTTP API
    const response = await fetch(`${getApiBaseUrl()}/api/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ embedding }),
    });

    return response.json();
  }
}

// Listen for backend status if in Tauri context
export function setupBackendListeners(
  onReady: () => void,
  onError: (error: string) => void
) {
  if (!isTauri()) return;

  // Use Tauri's event system to listen for backend status
  window.__TAURI__?.event.listen("backend-ready", (event) => {
    console.log("Backend is ready", event);
    onReady();
  });

  window.__TAURI__?.event.listen("backend-error", (event: any) => {
    console.error("Backend error:", event);
    // In Tauri v2, the payload format might be different
    const errorMessage =
      event.payload?.error ||
      event.payload ||
      "Unknown error starting the backend";
    onError(
      typeof errorMessage === "string"
        ? errorMessage
        : JSON.stringify(errorMessage)
    );
  });
}
