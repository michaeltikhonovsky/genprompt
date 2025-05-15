"use client";

import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { UserProfileDropdown } from "@/components/auth/UserProfileDropdown";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";

export function Navbar() {
  const { user } = useUser();

  return (
    <nav className="border-b border-white/10">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-end">
          <Link href="/">
            <Image src="/logo.png" alt="logo" width={48} height={48} />
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          {user ? (
            <UserProfileDropdown />
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-white border-white hover:bg-white/10 hover:text-white font-mono"
                >
                  Sign In
                </Button>
              </DialogTrigger>
              <AuthDialog />
            </Dialog>
          )}
        </div>
      </div>
    </nav>
  );
}
