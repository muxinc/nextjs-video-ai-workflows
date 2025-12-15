/* eslint-disable node/no-process-env */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create drizzle instance with schema
export const db = drizzle(pool, { schema });

// Re-export schema for convenience
export * from "./schema";
