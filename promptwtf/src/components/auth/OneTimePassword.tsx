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
    if (pin.length === 6 && !isVerifying) {
      form.handleSubmit(onSubmit)();
    }
  }, [pin, isVerifying]);

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    try {
      setIsVerifying(true);
      let verificationResult;

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

      if (verificationResult?.status === "complete") {
        try {
          console.log("Verification Result:", verificationResult);
          console.log("Attempt Object:", attempt);

          const clerkId =
            verificationResult.createdUserId || attempt.createdUserId;
          const email = attempt.emailAddress || attempt.identifier;

          if (!clerkId || !email) {
            throw new Error("Missing required user data");
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
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to sync user data");
          }

          toast.success("You've successfully logged in.");
          window.location.href = "/";
        } catch (err) {
          console.error("Failed to complete verification:", err);
          // Still redirect even if sync fails, we can try to sync again later
          window.location.href = "/";
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Invalid code");
      form.setValue("pin", "");
      setIsVerifying(false);
      // Re-focus the input after error
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
              <FormLabel className="text-white font-mono">
                Enter the code sent to your email.
              </FormLabel>
              <FormControl>
                <InputOTP maxLength={6} {...field} ref={inputRef}>
                  <InputOTPGroup>
                    <InputOTPSlot
                      className="h-16 w-16 text-lg bg-black text-white border-white"
                      index={0}
                    />
                    <InputOTPSlot
                      className="h-16 w-16 text-lg bg-black text-white border-white"
                      index={1}
                    />
                    <InputOTPSlot
                      className="h-16 w-16 text-lg bg-black text-white border-white"
                      index={2}
                    />
                    <InputOTPSlot
                      className="h-16 w-16 text-lg bg-black text-white border-white"
                      index={3}
                    />
                    <InputOTPSlot
                      className="h-16 w-16 text-lg bg-black text-white border-white"
                      index={4}
                    />
                    <InputOTPSlot
                      className="h-16 w-16 text-lg bg-black text-white border-white"
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
