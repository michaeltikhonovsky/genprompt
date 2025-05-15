import { users } from "./users";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export * from "./users";
export * from "./table";

// Zod Schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
