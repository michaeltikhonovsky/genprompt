import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function syncUser(
  clerkId: string,
  email: string,
  firstName?: string | null,
  lastName?: string | null
) {
  try {
    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1)
      .then((res) => res[0]);

    if (existingUser) {
      // Update existing user
      await db
        .update(users)
        .set({
          email,
          firstName:
            firstName === null ? null : firstName || existingUser.firstName,
          lastName:
            lastName === null ? null : lastName || existingUser.lastName,
        })
        .where(eq(users.clerkId, clerkId));

      return existingUser.id;
    }

    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        clerkId,
        email,
        firstName,
        lastName,
      })
      .returning({ id: users.id });

    return newUser.id;
  } catch (error) {
    console.error("Error syncing user:", error);
    throw error;
  }
}
