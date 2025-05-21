"use client";

import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { UserProfileDropdown } from "@/components/auth/UserProfileDropdown";
import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useTauri } from "@/components/TauriProvider";

export function Navbar() {
  const { user } = useUser();
  const pathname = usePathname();
  const { isDesktopView, isTauriApp } = useTauri();

  // Hide sign-in button on auth-callback page
  const isAuthCallbackPage = pathname === "/auth-callback";

  // Don't show navbar on desktop page or in Tauri app
  if (isDesktopView || isTauriApp) {
    return null;
  }

  return (
    <nav className="border-b border-indigo-400/20">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-end">
          <Link href="/">
            <Image src="/logo.png" alt="logo" width={48} height={48} />
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          {user ? (
            <UserProfileDropdown />
          ) : !isAuthCallbackPage ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="font-mono rounded-md border-indigo-400 bg-indigo-950/50 text-indigo-200 hover:bg-indigo-800/60 hover:text-white transition-all"
                >
                  Sign In
                </Button>
              </DialogTrigger>
              <AuthDialog />
            </Dialog>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
