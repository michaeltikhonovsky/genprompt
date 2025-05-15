import { NextResponse } from "next/server";
import { syncUser } from "@/lib/user";
import { z } from "zod";

const userSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  email: z.string().email("Invalid email format"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedData = userSchema.parse(body);

    await syncUser(
      validatedData.userId,
      validatedData.email,
      validatedData.firstName,
      validatedData.lastName
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error syncing user:", error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Handle other errors
    return NextResponse.json(
      {
        error: "Failed to sync user",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
