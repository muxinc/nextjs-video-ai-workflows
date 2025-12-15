/* eslint-disable node/no-process-env */
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local for Next.js convention
dotenv.config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
