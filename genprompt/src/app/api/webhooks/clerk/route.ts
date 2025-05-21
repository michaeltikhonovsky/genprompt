import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { syncUser } from "@/lib/user";

export async function POST(req: Request) {
  // Get the webhook signature from the headers
  const headersList = await headers();
  const svix_id = headersList.get("svix-id");
  const svix_timestamp = headersList.get("svix-timestamp");
  const svix_signature = headersList.get("svix-signature");

  // If there are no signatures, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your webhook secret
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Missing CLERK_WEBHOOK_SECRET environment variable");
    return new Response("Error: Missing webhook secret", {
      status: 500,
    });
  }

  // Create a new Svix instance with your webhook secret
  const wh = new Webhook(webhookSecret);

  let evt: WebhookEvent;

  // Verify the webhook
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error: Invalid webhook signature", {
      status: 400,
    });
  }

  // Handle the webhook event
  const eventType = evt.type;

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name } = evt.data;

    // Get primary email
    const primaryEmail = email_addresses?.find(
      (email: any) => email.id === evt.data.primary_email_address_id
    )?.email_address;

    if (id && primaryEmail) {
      try {
        await syncUser(
          id,
          primaryEmail,
          first_name || undefined,
          last_name || undefined
        );

        console.log(
          `User ${
            eventType === "user.created" ? "created" : "updated"
          } via webhook:`,
          id
        );
        return NextResponse.json({ success: true });
      } catch (error) {
        console.error("Error syncing user from webhook:", error);
        return NextResponse.json(
          { error: "Failed to sync user" },
          { status: 500 }
        );
      }
    } else {
      console.error("Missing required user data in webhook event");
      return NextResponse.json(
        { error: "Missing required user data" },
        { status: 400 }
      );
    }
  }

  // Return a response for other event types
  return NextResponse.json({ success: true });
}
