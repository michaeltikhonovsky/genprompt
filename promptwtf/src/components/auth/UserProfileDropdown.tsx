"use client";

import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, type InputProps } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { X } from "lucide-react";

export function UserProfileDropdown() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      });
    }
  }, [user]);

  useEffect(() => {
    if (isProfileModalOpen && user?.primaryEmailAddress?.emailAddress) {
      fetchUserProfile(user.primaryEmailAddress.emailAddress);
    }
  }, [isProfileModalOpen]);

  const fetchUserProfile = async (email: string) => {
    try {
      const response = await fetch(
        `/api/user?email=${encodeURIComponent(email)}`
      );
      if (response.ok) {
        const data = await response.json();
        setProfileData({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
        });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  if (!user) return null;

  const getInitial = () => {
    if (user.firstName) return user.firstName[0].toUpperCase();
    if (user.primaryEmailAddress)
      return user.primaryEmailAddress.emailAddress[0].toUpperCase();
    return "?";
  };

  const handleSignOut = () => {
    signOut();
    toast.success("Successfully signed out");
  };

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUpdating(true);
    const formData = new FormData(e.currentTarget);
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;

    try {
      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const email = user.primaryEmailAddress?.emailAddress;

      if (!email) {
        throw new Error("No email address found");
      }

      const response = await fetch("/api/user", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setProfileData({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
      });

      setIsProfileModalOpen(false);
      toast.success("Profile updated successfully");
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast.error(
        error?.message || "Failed to update profile. Please try again."
      );
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="relative h-10 w-10 rounded-full bg-black border border-white hover:bg-white/10"
          >
            <span className="text-white font-mono">{getInitial()}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 bg-black border-white text-white font-mono"
        >
          <DropdownMenuItem
            onClick={() => setIsProfileModalOpen(true)}
            className="cursor-pointer hover:bg-white/10"
          >
            Edit Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer hover:bg-white/10"
          >
            Log Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isProfileModalOpen} onOpenChange={setIsProfileModalOpen}>
        <DialogContent className="bg-black border-white text-white font-mono">
          <DialogClose className="absolute right-4 top-4 text-white hover:text-white/80">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={profileData.firstName}
                className="bg-black border-white text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={profileData.lastName}
                className="bg-black border-white text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                value={user.primaryEmailAddress?.emailAddress || ""}
                disabled
                cursorPointerOnDisabled
                className="bg-black border-white text-white opacity-50"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-white text-black hover:bg-white/90"
              disabled={isUpdating}
            >
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
