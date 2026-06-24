import "dotenv/config";

function splitCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: process.env.DATABASE_URL ?? "",
  corsOrigins: splitCsv(process.env.CORS_ORIGIN),
};

export function requireDatabaseUrl() {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy server/.env.example to server/.env and fill your Postgres connection string.");
  }
  return config.databaseUrl;
}
