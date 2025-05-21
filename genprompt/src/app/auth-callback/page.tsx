"use client";

import React, { useEffect } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const MAX_RETRIES = 10;
const RETRY_DELAY = 1500; // 1.5 seconds

export default function AuthCallback() {
  const { handleRedirectCallback } = useClerk();
  const { user, isLoaded: isUserLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    let retryCount = 0;
    let timeoutId: NodeJS.Timeout;
    let hasProcessed = false;

    async function syncUser() {
      if (!user?.id || !user?.primaryEmailAddress?.emailAddress) {
        console.log("Required user data not available:", {
          id: user?.id,
          email: user?.primaryEmailAddress?.emailAddress,
          isLoaded: isUserLoaded,
          userObject: user,
        });

        if (retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(
            `Retrying sync... Attempt ${retryCount} of ${MAX_RETRIES}`
          );
          timeoutId = setTimeout(syncUser, RETRY_DELAY);
          return;
        }

        throw new Error("Failed to get required user data after retries");
      }

      console.log("Attempting to sync user with ID:", user.id);

      const response = await fetch("/api/user/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          email: user.primaryEmailAddress.emailAddress,
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Sync response error:", response.status, data);
        throw new Error(data.error || "Failed to sync user data");
      }

      console.log("User sync successful:", data);
      return data;
    }

    async function processOAuthCallback() {
      if (hasProcessed) return;

      try {
        hasProcessed = true;
        // Handle the OAuth callback
        const redirectResult = await handleRedirectCallback({
          afterSignInUrl: "/",
          afterSignUpUrl: "/",
        });

        console.log("Redirect result:", redirectResult);

        // Add a small delay to ensure Clerk has fully processed the user data
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Wait for user data to be loaded before proceeding
        if (!isUserLoaded || !user) {
          console.log(
            "User data not yet loaded, waiting for next render cycle"
          );
          hasProcessed = false;
          return;
        }

        console.log("User data loaded:", {
          id: user?.id,
          email: user?.primaryEmailAddress?.emailAddress,
          firstName: user?.firstName,
          lastName: user?.lastName,
        });

        // If we have user data, sync it to our database
        try {
          await syncUser();
          toast.success("Successfully signed in!");
          router.push("/");
        } catch (err) {
          console.error("Failed to sync user:", err);
          // Log the full error details
          if (err instanceof Error) {
            console.error("Error details:", {
              message: err.message,
              stack: err.stack,
            });
          }
          toast.error("Failed to sync user data. Please try signing in again.");
          router.push("/");
        }
      } catch (err) {
        console.error("OAuth callback error:", err);
        toast.error("Authentication failed. Please try again.");
        router.push("/");
        hasProcessed = false;
      }
    }

    // Only run the callback processing if the user data is loaded
    if (isUserLoaded) {
      processOAuthCallback();
    } else {
      console.log("Waiting for user data to load...");
    }

    // Cleanup timeout on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [handleRedirectCallback, router, user, isUserLoaded]);

  return (
    <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Authenticating...</h1>
        <p className="text-gray-400">
          Please wait while we complete the authentication process.
        </p>
      </div>
    </div>
  );
}
