"use client";

import Image from "next/image";
import {
  ArrowUpFromLine,
  Upload,
  Loader2,
  Eye,
  ChevronDown,
  ChevronRight,
  Menu,
  Search,
  Zap,
  Copy,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { useTauri } from "@/components/TauriProvider";
import { isTauri } from "@/app/api/tauri-api";

export default function DesktopApp() {
  const { backendReady } = useTauri();
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

      // Add optional parameters as done in main page
      formData.append("prompt", "");
      formData.append("cfg", "7.5");
      formData.append("steps", "30");
      formData.append("sampler", "unknown");

      // Use the hardcoded server URL directly - just like in the main page.tsx
      // This avoids any issues with API routing
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
          // Use the direct URL for search too
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
    <div className="h-screen w-screen bg-black text-white font-mono overflow-hidden flex flex-col">
      {/* Top Bar with Title and Menu */}
      <div className="flex items-center justify-between p-3 bg-indigo-950/30 border-b border-indigo-400/30">
        <h1 className="text-xl font-bold tracking-tight">[prompt.wtf]</h1>
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-400">Desktop Edition</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-indigo-950/40 border border-indigo-400/30 hover:bg-indigo-900/50"
              >
                <Menu className="h-4 w-4 text-indigo-200" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-black border border-indigo-400/30 text-white min-w-[200px]">
              <DropdownMenuItem className="focus:bg-indigo-950 focus:text-white cursor-pointer">
                <Search className="mr-2 h-4 w-4" />
                <span>Similarity Search</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="focus:bg-indigo-950 focus:text-white cursor-pointer opacity-70"
                disabled
              >
                <Zap className="mr-2 h-4 w-4" />
                <span>AI Search (Coming Soon)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content Area - Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Upload Area */}
        <div className="w-1/3 border-r border-indigo-400/30 p-4 flex flex-col">
          <div className="text-center mb-4">
            <h2 className="text-lg font-semibold mb-2">Image Analysis</h2>
            <p className="text-sm text-gray-400 mb-4">
              Upload any AI-generated image to reveal the settings used to
              create it
            </p>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              size="sm"
              variant="outline"
              className="group font-mono rounded-md border border-indigo-400 bg-indigo-950/50 text-indigo-200 hover:bg-indigo-800/60 hover:text-white transition-all w-full"
              onClick={handleUploadClick}
              disabled={uploading || searching || !backendReady}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : searching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : !backendReady ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Waiting for backend...
                </>
              ) : (
                <>
                  <ArrowUpFromLine className="mr-2 h-4 w-4 text-current group-hover:translate-y-[-2px] transition-transform" />
                  Upload Image
                </>
              )}
            </Button>
          </div>

          {/* Image Preview */}
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-indigo-400/30 rounded-lg p-2 bg-indigo-950/10 overflow-hidden">
            {uploadedImage ? (
              <div className="relative w-full h-full">
                <Image
                  src={uploadedImage}
                  alt="Uploaded image"
                  fill
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="text-center text-gray-500 text-sm">
                <Upload className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>No image uploaded</p>
                <p className="text-xs mt-1">Supported formats: JPG, PNG</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Results Area */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          <h2 className="text-lg font-semibold mb-3">Analysis Results</h2>

          {searchResults.length > 0 ? (
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {/* Top 3 Matches */}
              <div className="grid grid-cols-1 gap-4 mb-4">
                {searchResults.slice(0, 3).map((result, index) => (
                  <div
                    key={index}
                    className="border border-indigo-400/30 rounded-md p-3 flex flex-col"
                  >
                    <div className="flex justify-between items-center mb-2 pb-1 border-b border-indigo-500/20">
                      <p className="text-indigo-200 font-bold text-sm">
                        Match #{index + 1} -{" "}
                        {(result.similarity * 100).toFixed(1)}% similar
                      </p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-indigo-300 hover:text-indigo-100 p-1 h-6 hover:bg-indigo-950/20 border border-indigo-500/50 text-xs"
                            onClick={() =>
                              openPromptDialog(
                                result.prompt || "No prompt available"
                              )
                            }
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View Prompt
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-black border border-indigo-500/30 text-white max-w-2xl">
                          <DialogTitle className="text-indigo-300 border-b border-indigo-500/20 pb-2 font-mono">
                            Prompt Details
                          </DialogTitle>
                          <div className="mt-4 max-h-[60vh] overflow-hidden flex flex-col">
                            <div className="bg-black/70 p-4 rounded border border-indigo-500/20 font-mono text-sm whitespace-pre-wrap overflow-y-auto custom-scrollbar relative group">
                              <button
                                className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-900/70 text-indigo-200 hover:text-white p-1.5 rounded-md"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    result.prompt || ""
                                  );
                                  toast.success("Prompt copied to clipboard");
                                }}
                              >
                                <Copy className="h-5 w-5" />
                              </button>
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

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {result.model && result.model !== "Unknown" && (
                        <div className="flex justify-between">
                          <div className="text-gray-400">Model:</div>
                          <div
                            className="text-indigo-100 font-mono truncate"
                            title={result.model}
                          >
                            {result.model}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between">
                        <div className="text-gray-400">CFG:</div>
                        <div className="text-indigo-100 font-mono">
                          {formatValue(result.cfg)}
                        </div>
                      </div>

                      <div className="flex justify-between">
                        <div className="text-gray-400">Steps:</div>
                        <div className="text-indigo-100 font-mono">
                          {formatValue(result.steps)}
                        </div>
                      </div>

                      <div className="flex justify-between">
                        <div className="text-gray-400">Sampler:</div>
                        <div
                          className="text-indigo-100 font-mono truncate"
                          title={result.sampler || "Unknown"}
                        >
                          {result.sampler || "Unknown"}
                        </div>
                      </div>

                      <div className="flex justify-between">
                        <div className="text-gray-400">Seed:</div>
                        <div
                          className="text-indigo-100 font-mono truncate"
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
                <div className="mt-2 mb-2">
                  <button
                    onClick={() => setShowPromptMatches(!showPromptMatches)}
                    className="flex items-center text-indigo-300 hover:text-indigo-100 mb-2 bg-indigo-950/20 border border-indigo-500/30 px-2 py-1 rounded-md text-xs"
                  >
                    {showPromptMatches ? (
                      <ChevronDown className="mr-1 h-3 w-3" />
                    ) : (
                      <ChevronRight className="mr-1 h-3 w-3" />
                    )}
                    Prompt Recommendations
                  </button>

                  {showPromptMatches && (
                    <div className="grid grid-cols-1 gap-3">
                      <p className="text-white text-xs">
                        Scores of ~30% are already strong semantic matches in
                        CLIP&apos;s cross-modal metric.
                      </p>
                      {promptMatches
                        .slice(0, 2)
                        .map((match: any, index: number) => (
                          <div
                            key={`prompt-${index}`}
                            className="border border-indigo-400/30 rounded-md p-3"
                          >
                            <p className="text-indigo-200 font-bold text-xs mb-1 pb-1 border-b border-indigo-500/20">
                              Prompt Match #{index + 1} -{" "}
                              {(match.similarity * 100).toFixed(1)}% similar
                            </p>
                            <div className="mb-2">
                              <div className="text-gray-400 text-xs mb-1">
                                Prompt:
                              </div>
                              <div className="bg-black/70 p-2 rounded border border-indigo-500/20 font-mono text-xs whitespace-pre-wrap overflow-y-hidden max-h-16 custom-scrollbar relative group">
                                <button
                                  className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-900/70 text-indigo-200 hover:text-white p-1.5 rounded-md"
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      match.prompt || ""
                                    );
                                    toast.success("Prompt copied to clipboard");
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                {match.prompt || "No prompt available"}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex gap-5">
                                <div className="text-gray-400">CFG:</div>
                                <div className="text-indigo-100 font-mono">
                                  {formatValue(match.cfg)}
                                </div>
                              </div>
                              <div className="flex gap-5">
                                <div className="text-gray-400">Steps:</div>
                                <div className="text-indigo-100 font-mono">
                                  {formatValue(match.steps)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : searching || uploading ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400 mb-4" />
              <p className="text-gray-400">Analyzing image patterns...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="max-w-xs">
                <Search className="h-10 w-10 mx-auto mb-3 text-indigo-500/50" />
                <p className="text-gray-300 mb-1">No Results Yet</p>
                <p className="text-gray-500 text-sm">
                  Upload an AI-generated image to analyze its patterns and
                  reveal the settings used to create it.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-3 py-1 bg-indigo-950/30 border-t border-indigo-400/30 text-xs text-gray-500 flex justify-between">
        <div>© 2025 prompt.wtf</div>
        <div>
          {backendReady ? "Backend: Connected" : "Backend: Connecting..."}
        </div>
      </div>
    </div>
  );
}
