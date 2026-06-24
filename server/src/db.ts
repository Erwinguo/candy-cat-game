import pg from "pg";
import { requireDatabaseUrl } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: requireDatabaseUrl(),
  max: 8,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

export async function query<T>(text: string, values: unknown[] = []) {
  const result = await pool.query<T>(text, values);
  return result;
}
