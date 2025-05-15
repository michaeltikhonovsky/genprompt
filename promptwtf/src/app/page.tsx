"use client";

import Image from "next/image";
import { ArrowUpFromLine, Info, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { useUser } from "@clerk/nextjs";
import dynamic from "next/dynamic";

const NotifyMeButton = dynamic(() => import("@/components/NotifyMeButton"), {
  ssr: false,
});

export default function Home() {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <header className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            [prompt.wtf]
          </h1>
          <p className="text-xl md:text-2xl text-gray-300">
            Upload any AI-generated image. We&apos;ll analyze them and attempt
            to reveal the settings used to create them.
          </p>
          <Separator className="my-8 bg-gray-800" />
          <p className="text-gray-400">
            Curious about the prompts, models, or parameters behind an image?
            Our tool helps you deconstruct AI art.
          </p>

          {/* Upload Button */}
          <div className="mt-12">
            <p className="text-sm mb-4">(Coming soon)</p>
            <Button
              size="lg"
              variant="outline"
              className="group border-gray-700 hover:border-white transition-all duration-300 text-white hover:text-slate-700"
              disabled
            >
              <ArrowUpFromLine className="mr-2 h-5 w-5 text-current group-hover:translate-y-[-2px] transition-transform" />
              Upload Your Image
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Demo Section */}
        <section className="max-w-5xl mx-auto my-16">
          <div className="flex items-center mb-8">
            <Zap className="mr-3 h-5 w-5 text-gray-400" />
            <h2 className="text-2xl font-semibold">See it in Action</h2>
          </div>

          <p className="text-gray-300 mb-10 max-w-3xl">
            Ever wondered how an image was created? Upload it, and we&apos;ll
            help you uncover the potential prompts and settings. Here are some
            examples:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {demoItems.map((demo) => (
              <Card
                key={demo.src}
                className="bg-black border border-gray-700 overflow-hidden group hover:border-gray-500 transition-all duration-300 w-full max-w-xs mx-auto"
              >
                <div className="w-full h-64 relative">
                  {demo.type === "image" ? (
                    <Image
                      src={demo.src || "/placeholder.svg"}
                      alt={demo.alt}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-contain p-2"
                    />
                  ) : (
                    <video
                      src={demo.src}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-contain p-2"
                      aria-label={demo.alt}
                    ></video>
                  )}
                </div>
                <div className="p-3 border-t border-gray-700">
                  <p className="text-sm text-gray-400">{demo.caption}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Coming Soon Section */}
        <section className="max-w-3xl mx-auto text-center py-16 border-t border-gray-900">
          <div className="inline-flex items-center justify-center mb-4 px-4 py-1 rounded-full bg-gray-900">
            <Info className="h-4 w-4 mr-2 text-gray-400" />
            <p className="text-sm text-gray-300">Coming Soon</p>
          </div>
          <p className="text-xl font-semibold mb-2">Join the waitlist</p>
          <p className="text-gray-400 text-sm">
            Be the first to know when we launch. Sign up for updates.
          </p>
          <NotifyMeButton />
        </section>
      </main>

      <footer className="container mx-auto px-4 py-8 text-center text-gray-600 text-sm border-t border-gray-900">
        <p>
          © 2025 prompt.wtf — Uncover the secrets behind AI-generated images
        </p>
      </footer>
    </div>
  );
}

const demoItems = [
  {
    type: "image",
    src: "/demos/demo0.avif",
    alt: "Demo AVIF Image",
    caption: "Midjourney v5 • Cinematic lighting • 8K",
  },
  {
    type: "video",
    src: "/demos/demo1.mp4",
    alt: "Demo MP4 Video",
    caption: "Stable Diffusion XL • Animation preset • 24fps",
  },
  {
    type: "image",
    src: "/demos/demo2.jpeg",
    alt: "Demo JPEG Image",
    caption: "DALL-E 3 • Photorealistic • High detail",
  },
  {
    type: "image",
    src: "/demos/demo3.jpg",
    alt: "Demo JPG Image",
    caption: "Stable Diffusion • Dreamlike • Low CFG",
  },
  {
    type: "image",
    src: "/demos/demo4.png",
    alt: "Demo PNG Image",
    caption: "Midjourney v6 • Illustration style • Vibrant",
  },
  {
    type: "image",
    src: "/demos/demo5.png",
    alt: "Demo 5 Image",
    caption: "Stable Diffusion • Anime Style • Dramatic Lighting",
  },
];
