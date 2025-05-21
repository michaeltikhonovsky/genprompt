"use client";

import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { TauriProvider } from "@/components/TauriProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function DesktopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${geistSans.variable} ${geistMono.variable} ${geistSans.className} antialiased bg-black`}
    >
      <TauriProvider>
        <Toaster />
        {children}
      </TauriProvider>
    </div>
  );
}
