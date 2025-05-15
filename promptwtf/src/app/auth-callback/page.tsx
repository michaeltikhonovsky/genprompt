"use client";

import React, { useEffect } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function AuthCallback() {
  const { handleRedirectCallback } = useClerk();
  const { user, isLoaded: isUserLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    async function processOAuthCallback() {
      try {
        // Handle the OAuth callback first
        await handleRedirectCallback({
          afterSignInUrl: "/",
          afterSignUpUrl: "/",
        });

        // Wait for user data to be loaded
        if (!isUserLoaded || !user) {
          console.log("User data not loaded yet, waiting...");
          return;
        }

        console.log("User data loaded:", {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          firstName: user.firstName,
          lastName: user.lastName,
        });

        // If we have user data, sync it to our database
        try {
          const response = await fetch("/api/user/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: user.id,
              email: user.primaryEmailAddress?.emailAddress || "",
              firstName: user.firstName || undefined,
              lastName: user.lastName || undefined,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || "Failed to sync user data");
          }

          console.log("User sync successful:", data);
          toast.success("Successfully signed in!");
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
        }

        // After everything is done, redirect to home page
        router.push("/");
      } catch (err) {
        console.error("OAuth callback error:", err);
        toast.error("Authentication failed. Please try again.");
        router.push("/");
      }
    }

    processOAuthCallback();
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
