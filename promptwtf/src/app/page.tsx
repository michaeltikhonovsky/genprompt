"use client";

import Image from "next/image";
import {
  ArrowUpFromLine,
  Info,
  Zap,
  Upload,
  Loader2,
  Eye,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { useUser } from "@clerk/nextjs";
import { FaXTwitter, FaGithub } from "react-icons/fa6";
import { useRef, useState } from "react";
import { toast } from "sonner";

export default function Home() {
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [promptMatches, setPromptMatches] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string>("");
  const [showPromptMatches, setShowPromptMatches] = useState(false);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a valid image file (JPEG, PNG)");
      return;
    }

    try {
      setUploading(true);
      setSearchResults([]);

      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Create form data
      const formData = new FormData();
      formData.append("image", file);

      // You can add optional parameters if needed
      formData.append("prompt", "");
      formData.append("cfg", "7.5");
      formData.append("steps", "30");
      formData.append("sampler", "unknown");

      // Send to server
      const response = await fetch("http://localhost:5001/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setAnalysis(data);

      if (
        data.results &&
        data.results.image_matches &&
        data.results.image_matches.length > 0
      ) {
        setSearchResults(data.results.image_matches);
        if (data.results.prompt_matches) {
          setPromptMatches(data.results.prompt_matches);
        }
        toast.success("Image uploaded and analyzed successfully!");
      } else if (data.embedding) {
        // Call the search endpoint with the embedding
        setSearching(true);
        try {
          const searchResponse = await fetch(
            "http://localhost:5001/api/search",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                embedding: data.embedding,
              }),
            }
          );

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.success && searchData.results) {
              if (Array.isArray(searchData.results)) {
                setSearchResults(searchData.results);
              } else if (searchData.results.image_matches) {
                setSearchResults(searchData.results.image_matches);
                if (searchData.results.prompt_matches) {
                  setPromptMatches(searchData.results.prompt_matches);
                }
              }
              toast.success("Analysis complete!");
            }
          }
        } catch (searchError) {
          console.error("Search error:", searchError);
          toast.error("Failed to analyze image patterns");
        } finally {
          setSearching(false);
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Format a value based on type
  const formatValue = (value: any) => {
    if (value === null || value === undefined) return "N/A";

    // Handle numbers
    if (typeof value === "number") {
      // Large integers like seeds should be formatted without decimals
      if (value > 1000000 && Number.isInteger(value)) {
        // If the seed is very large, format it without decimal points
        return Math.round(value).toString();
      }
      // For CFG and other decimal values, display with 2 decimal places
      return value.toFixed(2);
    }

    return value;
  };

  const openPromptDialog = (prompt: string) => {
    setSelectedPrompt(prompt || "No prompt available");
  };

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      <header className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto text-center space-y-6">
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
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              size="lg"
              variant="outline"
              className="group font-mono rounded-md border border-indigo-400 bg-indigo-950/50 text-indigo-200 hover:bg-indigo-800/60 hover:text-white transition-all"
              onClick={handleUploadClick}
              // disabled={uploading || searching}
              disabled
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Uploading...
                </>
              ) : searching ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <ArrowUpFromLine className="mr-2 h-5 w-5 text-current group-hover:translate-y-[-2px] transition-transform" />
                  Upload Your Image
                </>
              )}
            </Button>
          </div>

          {/* Preview Section */}
          {uploadedImage && (
            <div className="mt-8 bg-gradient-to-br from-black to-indigo-950/30 border-2 border-indigo-400/50 rounded-lg p-6 max-w-full mx-auto">
              <h3 className="text-xl font-semibold mb-4">
                Your Uploaded Image
              </h3>
              <div className="relative w-full h-64 mb-6">
                <Image
                  src={uploadedImage}
                  alt="Uploaded image"
                  fill
                  className="object-contain"
                />
              </div>

              {searchResults.length > 0 ? (
                <div className="text-left">
                  <h4 className="text-lg font-semibold text-indigo-300 mb-4">
                    Potential Parameters
                  </h4>

                  {/* Top 3 Matches */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 max-w-full mx-auto">
                    {searchResults.slice(0, 3).map((result, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-b from-black/70 to-indigo-950/20 border border-indigo-400/30 rounded-md p-4 md:p-5 flex flex-col h-full"
                      >
                        <p className="text-indigo-200 font-bold text-sm md:text-lg mb-2 md:mb-3 pb-2 border-b border-indigo-500/20">
                          Match #{index + 1} -{" "}
                          {(result.similarity * 100).toFixed(1)}% similar
                        </p>

                        <div className="mb-2 md:mb-3 flex items-center justify-between">
                          <div className="text-gray-400 text-xs uppercase">
                            Prompt:
                          </div>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-indigo-300 hover:text-indigo-100 p-1 h-auto hover:bg-indigo-950/20 border border-indigo-500/50"
                                onClick={() =>
                                  openPromptDialog(
                                    result.prompt || "No prompt available"
                                  )
                                }
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                <span className="text-xs">View</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-black border border-indigo-500/30 text-white max-w-2xl">
                              <DialogTitle className="text-indigo-300 border-b border-indigo-500/20 pb-2 font-mono">
                                Prompt Details
                              </DialogTitle>
                              <div className="mt-4 max-h-[60vh] overflow-hidden flex flex-col">
                                <div className="bg-black/70 p-4 rounded border border-indigo-500/20 font-mono text-sm whitespace-pre-wrap overflow-y-auto">
                                  {result.prompt || "No prompt available"}
                                </div>
                              </div>
                              <div className="mt-4 pt-2 border-t border-indigo-500/20 flex justify-end">
                                <DialogClose asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="font-mono text-xs"
                                  >
                                    Close
                                  </Button>
                                </DialogClose>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>

                        <div className="flex-grow space-y-2 text-sm">
                          {result.model && result.model !== "Unknown" && (
                            <div className="grid grid-cols-[30%_70%]">
                              <div className="text-gray-400">Model:</div>
                              <div
                                className="text-right text-indigo-100 font-mono truncate"
                                title={result.model}
                              >
                                {result.model}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-[30%_70%]">
                            <div className="text-gray-400">CFG:</div>
                            <div className="text-right text-indigo-100 font-mono">
                              {formatValue(result.cfg)}
                            </div>
                          </div>

                          <div className="grid grid-cols-[30%_70%]">
                            <div className="text-gray-400">Steps:</div>
                            <div className="text-right text-indigo-100 font-mono">
                              {formatValue(result.steps)}
                            </div>
                          </div>

                          <div className="grid grid-cols-[30%_70%]">
                            <div className="text-gray-400">Sampler:</div>
                            <div
                              className="text-right text-indigo-100 font-mono truncate"
                              title={result.sampler || "Unknown"}
                            >
                              {result.sampler || "Unknown"}
                            </div>
                          </div>

                          <div className="grid grid-cols-[30%_70%]">
                            <div className="text-gray-400">Seed:</div>
                            <div
                              className="text-right text-indigo-100 font-mono truncate"
                              title={formatValue(result.seed)}
                            >
                              {formatValue(result.seed)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Prompt Matches Section */}
                  {promptMatches.length > 0 && (
                    <div className="mt-8">
                      <p className="text-gray-400 text-sm mb-4">
                        Need ideas? Prompt recommendations can help recreate a
                        look close to your image.
                      </p>
                      <button
                        onClick={() => setShowPromptMatches(!showPromptMatches)}
                        className="flex items-center text-indigo-300 hover:text-indigo-100 mb-4 bg-indigo-950/20 border border-indigo-500/30 px-3 py-2 rounded-md"
                      >
                        {showPromptMatches ? (
                          <ChevronDown className="mr-2 h-4 w-4" />
                        ) : (
                          <ChevronRight className="mr-2 h-4 w-4" />
                        )}
                        Show Prompt Recommendations
                      </button>

                      {showPromptMatches && (
                        <div className="grid grid-cols-1 gap-4 max-w-full mx-auto">
                          <p className="text-white text-sm mb-4">
                            Wondering why the % seems low? Image-to-prompt
                            scores top out at ~40% in CLIP&apos;s cross-modal
                            metric, so even 30% is already a strong semantic
                            match.
                          </p>
                          {promptMatches
                            .slice(0, 3)
                            .map((match: any, index: number) => (
                              <div
                                key={`prompt-${index}`}
                                className="bg-gradient-to-b from-black/70 to-indigo-950/20 border border-indigo-400/30 rounded-md p-4"
                              >
                                <p className="text-indigo-200 font-bold text-sm md:text-base mb-2 pb-2 border-b border-indigo-500/20">
                                  Prompt Match #{index + 1} -{" "}
                                  {(match.similarity * 100).toFixed(1)}% similar
                                </p>
                                <div className="mb-3">
                                  <div className="text-gray-400 text-xs uppercase mb-1">
                                    Prompt:
                                  </div>
                                  <div className="bg-black/70 p-3 rounded border border-indigo-500/20 font-mono text-sm whitespace-pre-wrap overflow-y-auto max-h-32">
                                    {match.prompt || "No prompt available"}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <div className="grid grid-cols-[30%_70%]">
                                    <div className="text-gray-400">CFG:</div>
                                    <div className=" text-indigo-100 font-mono">
                                      {formatValue(match.cfg)}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-[30%_70%]">
                                    <div className="text-gray-400">Steps:</div>
                                    <div className=" text-indigo-100 font-mono">
                                      {formatValue(match.steps)}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-[30%_70%]">
                                    <div className="text-gray-400">
                                      Sampler:
                                    </div>
                                    <div className=" text-indigo-100 font-mono truncate">
                                      {match.sampler || "Unknown"}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-[30%_70%]">
                                    <div className="text-gray-400">Seed:</div>
                                    <div className=" text-indigo-100 font-mono truncate">
                                      {formatValue(match.seed)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-2">
                    Note: Results are based on pattern matching and may not be
                    100% accurate.
                  </p>
                </div>
              ) : searching || uploading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-400 mb-4" />
                  <p className="text-gray-400">Analyzing image patterns...</p>
                </div>
              ) : (
                <p className="text-gray-400 text-center">
                  Analysis will appear here after processing...
                </p>
              )}
            </div>
          )}
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
                className="bg-gradient-to-br from-black to-indigo-950/30 border-2 border-indigo-400/50 rounded-lg overflow-hidden group hover:border-indigo-400 hover:shadow-[0_0_15px_rgba(79,70,229,0.2)] transition-all duration-300 w-full max-w-xs mx-auto"
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
                <div className="p-3 border-t border-indigo-400/30">
                  <p className="text-sm text-indigo-200">{demo.caption}</p>
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
          {user ? (
            <div className="flex flex-col items-center gap-2 mt-6">
              <Button
                variant="ghost"
                className="font-mono rounded-md border border-indigo-400 bg-indigo-950/50 text-indigo-200 hover:bg-indigo-800/60 hover:text-white transition-all"
                disabled
              >
                ✓ You&apos;re on the list
              </Button>
              <span className="text-sm text-indigo-300/60">
                We&apos;ll notify you at{" "}
                {user.primaryEmailAddress?.emailAddress}
              </span>
            </div>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="mt-6 font-mono rounded-md border border-indigo-400 bg-indigo-950/50 text-indigo-200 hover:bg-indigo-800/60 hover:text-white transition-all"
                >
                  Notify Me
                </Button>
              </DialogTrigger>
              <AuthDialog />
            </Dialog>
          )}
        </section>
      </main>

      <footer className="container mx-auto px-4 py-8 text-center text-gray-600 text-sm border-t border-gray-900">
        <p className="flex items-center justify-center gap-2">
          © 2025 prompt.wtf
          <span className="mx-2">•</span>
          <a
            href="https://twitter.com/promptwtf"
            className="hover:text-gray-400 transition-colors"
            aria-label="Twitter"
          >
            <FaXTwitter />
          </a>
          <a
            href="https://github.com/michaeltikhonovsky"
            className="hover:text-gray-400 transition-colors"
            aria-label="GitHub"
          >
            <FaGithub />
          </a>
          <span className="mx-2">•</span>
          Uncover the secrets behind AI-generated images
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
    caption: "Midjourney v6 • detailed painting • k_lms",
  },
  {
    type: "image",
    src: "/demos/demo3.jpg",
    alt: "Demo JPG Image",
    caption: "Stable Diffusion • hyperdetailed • 8K",
  },
  {
    type: "image",
    src: "/demos/demo4.png",
    alt: "Demo PNG Image",
    caption: "Midjourney v6 • action shot • Vibrant",
  },
  {
    type: "image",
    src: "/demos/demo5.png",
    alt: "Demo 5 Image",
    caption: "Stable Diffusion • Anime Style • k_euler_ancestral",
  },
];
