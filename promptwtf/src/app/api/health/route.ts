import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/env";

export async function GET() {
  try {
    // Check if DATABASE_URL is set
    if (!env.DATABASE_URL) {
      return NextResponse.json(
        {
          status: "unhealthy",
          database: {
            connected: false,
            error: "DATABASE_URL environment variable is not set",
          },
          environment: env.NODE_ENV,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Try to parse the database URL (without exposing credentials)
    try {
      const dbUrl = new URL(env.DATABASE_URL);
      console.log("Database host:", dbUrl.hostname);
      console.log("Database port:", dbUrl.port);
      console.log("Database name:", dbUrl.pathname.slice(1));
    } catch (e) {
      console.error("Invalid DATABASE_URL format:", e);
    }

    // Try to perform a simple query
    const startTime = Date.now();
    const result = await db.select({ count: users.id }).from(users).limit(1);
    const endTime = Date.now();

    return NextResponse.json({
      status: "healthy",
      database: {
        connected: true,
        responseTime: `${endTime - startTime}ms`,
        host: new URL(env.DATABASE_URL).hostname,
        hasResults: result.length > 0,
      },
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);

    // Determine if it's a connection error
    const isConnectionError =
      error instanceof Error &&
      (error.message.includes("ENOTFOUND") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("getaddrinfo"));

    return NextResponse.json(
      {
        status: "unhealthy",
        database: {
          connected: false,
          error:
            error instanceof Error ? error.message : "Unknown database error",
          errorType: isConnectionError ? "connection_error" : "query_error",
          host: env.DATABASE_URL
            ? new URL(env.DATABASE_URL).hostname
            : "unknown",
        },
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
      }
    );
  }
}
