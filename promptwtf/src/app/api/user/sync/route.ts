import { NextResponse } from "next/server";
import { syncUser } from "@/lib/user";

export async function POST(request: Request) {
  try {
    const { userId, email, firstName, lastName } = await request.json();

    await syncUser(userId, email, firstName, lastName);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error syncing user:", error);
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }
}
