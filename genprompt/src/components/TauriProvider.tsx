"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { isTauri, setupBackendListeners } from "@/app/api/tauri-api";
import { usePathname } from "next/navigation";

interface TauriContextType {
  isTauriApp: boolean;
  backendReady: boolean;
  backendError: string | null;
  isDesktopView: boolean;
}

interface BackendStatus {
  running?: boolean;
  [key: string]: any;
}

// Default context value
const TauriContext = createContext<TauriContextType>({
  isTauriApp: false,
  backendReady: false,
  backendError: null,
  isDesktopView: false,
});

// Hook to use the Tauri context
export function useTauri() {
  return useContext(TauriContext);
}

interface TauriProviderProps {
  children: ReactNode;
}

export function TauriProvider({ children }: TauriProviderProps) {
  const [backendReady, setBackendReady] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const isTauriApp = isTauri();
  const pathname = usePathname();
  const isDesktopView = pathname === "/desktop" || pathname === "/desktop/";

  // Set backend ready immediately for non-Tauri apps or after a timeout
  useEffect(() => {
    if (!isTauriApp) {
      // If not in Tauri, immediately set backend ready
      setBackendReady(true);
      return;
    }

    // Set up backend listeners for Tauri
    setupBackendListeners(
      () => setBackendReady(true),
      (error) => setBackendError(error)
    );

    // Try to get backend status
    const checkBackendStatus = async () => {
      try {
        if (window.__TAURI__?.invoke) {
          const status = await window.__TAURI__!.invoke<BackendStatus>(
            "get_backend_status"
          );
          if (status && status.running) {
            setBackendReady(true);
          }
        }
      } catch (error) {
        console.error("Error checking backend status:", error);
        // Don't set an error here as it might be just that the command doesn't exist yet
      }
    };

    checkBackendStatus();

    // Fallback: Set backend ready after a timeout to prevent infinite waiting
    const timeoutId = setTimeout(() => {
      if (!backendReady && !backendError) {
        console.log("Backend detection timed out - proceeding anyway");
        setBackendReady(true);
      }
    }, 5000); // Wait 5 seconds max

    return () => clearTimeout(timeoutId);
  }, [isTauriApp, backendReady, backendError]);

  return (
    <TauriContext.Provider
      value={{ isTauriApp, backendReady, backendError, isDesktopView }}
    >
      {children}

      {/* Display a loading indicator or error message for Tauri app */}
      {isTauriApp && !backendReady && !backendError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-black p-6 rounded-lg shadow-lg text-center border border-indigo-400/30">
            <h2 className="text-xl font-bold mb-2 text-indigo-200">
              Starting application...
            </h2>
            <p className="text-gray-300">
              Please wait while we set up the backend services
            </p>
          </div>
        </div>
      )}

      {/* Show error if backend failed to start */}
      {isTauriApp && backendError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-black p-6 rounded-lg shadow-lg text-center max-w-md border border-red-500/30">
            <h2 className="text-xl font-bold mb-2 text-red-400">
              Error Starting Application
            </h2>
            <p className="mb-4 text-gray-300">{backendError}</p>
            <button
              className="px-4 py-2 bg-indigo-800 text-white rounded hover:bg-indigo-700"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </TauriContext.Provider>
  );
}
