"use client";

import React, { useEffect } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { syncUser } from "@/lib/user";

export default function AuthCallback() {
  const { handleRedirectCallback } = useClerk();
  const { user } = useUser();
  const router = useRouter();

  useEffect(() => {
    async function processOAuthCallback() {
      try {
        const result = await handleRedirectCallback({
          afterSignInUrl: "/",
          afterSignUpUrl: "/",
        });

        // If we have user data, sync it to our database
        if (user) {
          await syncUser(
            user.id,
            user.primaryEmailAddress?.emailAddress || "",
            user.firstName || undefined,
            user.lastName || undefined
          );
        }

        // After successful authentication, redirect to home page
        router.push("/");
      } catch (err) {
        console.error("OAuth callback error:", err);
        // If there's an error, still redirect to home page
        router.push("/");
      }
    }

    processOAuthCallback();
  }, [handleRedirectCallback, router, user]);

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
