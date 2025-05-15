"use client";

import { useUser } from "@clerk/nextjs";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth/AuthDialog";

export default function NotifyMeButton() {
  const { user } = useUser();

  return (
    <Dialog>
      <DialogTrigger asChild>
        {user ? (
          <div className="flex items-center gap-2 mt-6">
            <Button
              variant="ghost"
              className="text-gray-300 border-white border-1"
              disabled
            >
              ✓ You&apos;re on the list
            </Button>
            <span className="text-sm text-gray-500">
              We&apos;ll notify you at {user.primaryEmailAddress?.emailAddress}
            </span>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="mt-6 text-gray-300 border-white border-1"
          >
            Notify Me
          </Button>
        )}
      </DialogTrigger>
      <AuthDialog />
    </Dialog>
  );
}
