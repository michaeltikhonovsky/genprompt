"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { type OAuthStrategy } from "@clerk/types";
import { GithubIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import OneTimePassword from "./OneTimePassword";
import { Loader2 } from "lucide-react";

export function AuthDialog() {
  const { signIn, isLoaded: isSignInLoaded } = useSignIn();
  const { signUp, isLoaded: isSignUpLoaded } = useSignUp();

  const signInWith = (strategy: OAuthStrategy) => {
    return signIn
      ?.authenticateWithRedirect({
        strategy,
        redirectUrl:
          process.env.NODE_ENV === "development"
            ? `/auth-callback`
            : "https://www.promptwtf.app/auth-callback",
        redirectUrlComplete:
          process.env.NODE_ENV === "development"
            ? `/auth-callback`
            : "https://www.promptwtf.app/auth-callback",
      })
      .then((res: any) => {
        console.log(res);
      })
      .catch((err: any) => {
        console.log(err.errors);
        console.error(err, null, 2);
      });
  };

  const formSchema = z.object({
    email: z.string().email({ message: "please provide a valid email." }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const [pendingVerification, setPendingVerification] = useState(false);
  const [activeAttempt, setActiveAttempt] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!isSignInLoaded || !isSignUpLoaded) {
      return;
    }
    setIsLoading(true);
    try {
      try {
        const signInAttempt = await signIn.create({
          identifier: data.email,
          strategy: "email_code",
        });
        setActiveAttempt(signInAttempt);
        setPendingVerification(true);
      } catch (err: any) {
        if (err.errors?.[0]?.code === "form_identifier_not_found") {
          const signUpAttempt = await signUp.create({
            emailAddress: data.email,
          });

          const verificationAttempt =
            await signUpAttempt.prepareEmailAddressVerification({
              strategy: "email_code",
            });

          setActiveAttempt(verificationAttempt);
          setPendingVerification(true);
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.errors?.[0]?.message || "Something went wrong",
        variant: "destructive",
      });
      console.error(JSON.stringify(err, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  if (!signIn) return null;

  return (
    <DialogContent className="sm:max-w-md bg-black border-white rounded-none">
      <DialogHeader>
        <DialogTitle className="text-white font-mono">
          JOIN PROMPT.WTF
        </DialogTitle>
      </DialogHeader>
      <div className="grid gap-6 py-4">
        <div className="grid gap-3">
          <Button
            variant="outline"
            className="flex items-center justify-center gap-2 w-full rounded-none border-white text-white hover:bg-white/10 hover:text-whitefont-mono font-mono"
            onClick={() => signInWith("oauth_google")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24"
              viewBox="0 0 24 24"
              width="24"
              className="h-5 w-5"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            CONTINUE WITH GOOGLE
          </Button>

          <Button
            variant="outline"
            className="flex items-center justify-center gap-2 w-full rounded-none border-white text-white hover:bg-white/10 hover:text-white font-mono"
            onClick={() => signInWith("oauth_github")}
          >
            <GithubIcon className="h-5 w-5" />
            CONTINUE WITH GITHUB
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/30" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-black px-2 text-white font-mono">
              OR CONTINUE WITH EMAIL
            </span>
          </div>
        </div>

        {/* Email form */}
        <div className="grid gap-4">
          {pendingVerification ? (
            <OneTimePassword attempt={activeAttempt} />
          ) : (
            <FormProvider {...form}>
              <form
                className="grid gap-2"
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-white font-mono">
                        EMAIL
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="user@prompt.wtf"
                          className="bg-black border border-white rounded-none px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-white"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div id="clerk-captcha" className="mt-2" />
                <Button
                  type="submit"
                  className="w-full rounded-none font-mono bg-white hover:bg-white/90 text-black"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending code...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </form>
            </FormProvider>
          )}
        </div>
      </div>
    </DialogContent>
  );
}
