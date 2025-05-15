import { pgTableCreator } from "drizzle-orm/pg-core";

/**
 * This creates a table name prefixer to avoid conflicts in a shared database.
 * All table names will be prefixed with 'promptwtf_'
 */
export const createTable = pgTableCreator((name) => `promptwtf_${name}`);
