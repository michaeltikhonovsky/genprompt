import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Navbar } from "@/components/Navbar";
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

export const metadata: Metadata = {
  title: "genprompt",
  description: "Uncover the secrets behind AI-generated images",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${geistSans.className} antialiased bg-black`}
        >
          <TauriProvider>
            <Navbar />
            <Toaster />
            {children}
          </TauriProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
