"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { useSignIn, useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Loader2 } from "lucide-react";

const FormSchema = z.object({
  pin: z.string().min(6, {
    message: "Your one-time password must be 6 characters.",
  }),
});

interface OneTimePasswordProps {
  attempt: any;
}

export default function OneTimePassword({ attempt }: OneTimePasswordProps) {
  const { signIn } = useSignIn();
  const { user } = useUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [submissionAttempted, setSubmissionAttempted] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      pin: "",
    },
  });

  const pin = useWatch({
    control: form.control,
    name: "pin",
  });

  useEffect(() => {
    // Auto focus the input when component mounts
    const timeoutId = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (pin.length === 6 && !isVerifying && !submissionAttempted) {
      setSubmissionAttempted(true);
      form.handleSubmit(onSubmit)();
    }
  }, [pin, isVerifying, submissionAttempted]);

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    if (isVerifying) return; // Prevent multiple submissions

    try {
      setIsVerifying(true);
      let verificationResult;

      console.log("Attempt status:", attempt.status);
      console.log("Attempt object:", attempt);

      if (attempt.status === "needs_first_factor") {
        verificationResult = await attempt.attemptFirstFactor({
          strategy: "email_code",
          code: data.pin,
        });
      } else {
        verificationResult = await attempt.attemptEmailAddressVerification({
          code: data.pin,
        });
      }

      console.log("Verification result:", verificationResult);

      if (verificationResult?.status === "complete") {
        try {
          // For sign-in attempts
          let clerkId = verificationResult.createdUserId;
          let email = attempt.emailAddress;

          // For first-time sign-ups
          if (!clerkId && attempt.status === "needs_first_factor") {
            clerkId = verificationResult.userId || attempt.createdUserId;
            email = attempt.identifier;
          }

          console.log("Extracted data:", { clerkId, email });

          if (!clerkId || !email) {
            console.error("Missing user data:", {
              clerkId,
              email,
              verificationResult,
              attempt,
            });
            throw new Error(
              "Missing required user data. Please try signing in again."
            );
          }

          // Sync user to database using the sync endpoint
          const response = await fetch("/api/user/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: clerkId,
              email: email,
              firstName: attempt.firstName || undefined,
              lastName: attempt.lastName || undefined,
            }),
          });

          const responseData = await response.json();

          if (!response.ok) {
            throw new Error(responseData.error || "Failed to sync user data");
          }

          toast.success("You've successfully logged in!");

          // Use a small delay before redirect to ensure toast is shown
          setTimeout(() => {
            window.location.href = "/";
          }, 1000);
        } catch (err) {
          console.error("Failed to complete verification:", err);
          toast.error(
            err instanceof Error
              ? err.message
              : "Failed to complete sign up. Please try again."
          );
          setIsVerifying(false);
          setSubmissionAttempted(false);
          form.setValue("pin", "");
          inputRef.current?.focus();
        }
      } else {
        console.error("Incomplete verification:", verificationResult);
        throw new Error("Verification incomplete. Please try again.");
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      toast.error(
        err.errors?.[0]?.message ||
          err.message ||
          "Invalid code. Please try again."
      );
      setIsVerifying(false);
      setSubmissionAttempted(false);
      form.setValue("pin", "");
      inputRef.current?.focus();
    }
  }

  if (isVerifying) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-4">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
        <p className="text-white font-mono">Verifying code...</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex w-full flex-col items-center justify-center gap-2"
      >
        <FormField
          control={form.control}
          name="pin"
          render={({ field }) => (
            <FormItem className="flex w-full flex-col items-center justify-center gap-2">
              <FormLabel className="text-white font-mono text-center">
                Enter the code sent to your email
                <br />
                <br />
                <span className="text-xs text-white">
                  If you don't see it, check your spam folder
                </span>
              </FormLabel>
              <FormControl>
                <InputOTP maxLength={6} {...field} ref={inputRef}>
                  <InputOTPGroup>
                    <InputOTPSlot
                      className="h-12 w-12 text-lg bg-black text-white border-white"
                      index={0}
                    />
                    <InputOTPSlot
                      className="h-12 w-12 text-lg bg-black text-white border-white"
                      index={1}
                    />
                    <InputOTPSlot
                      className="h-12 w-12 text-lg bg-black text-white border-white"
                      index={2}
                    />
                    <InputOTPSlot
                      className="h-12 w-12 text-lg bg-black text-white border-white"
                      index={3}
                    />
                    <InputOTPSlot
                      className="h-12 w-12 text-lg bg-black text-white border-white"
                      index={4}
                    />
                    <InputOTPSlot
                      className="h-12 w-12 text-lg bg-black text-white border-white"
                      index={5}
                    />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
