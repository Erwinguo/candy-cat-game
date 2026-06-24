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
  jwtSecret: process.env.JWT_SECRET ?? "tangdou-dev-secret-change-in-production",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:8787/api/auth/google/callback",
  wechatAppId: process.env.WECHAT_APP_ID ?? "",
  wechatAppSecret: process.env.WECHAT_APP_SECRET ?? "",
  wechatRedirectUri: process.env.WECHAT_REDIRECT_URI ?? "http://localhost:8787/api/auth/wechat/callback",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://127.0.0.1:5501",
};

export function requireDatabaseUrl() {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy server/.env.example to server/.env and fill your Postgres connection string.");
  }
  return config.databaseUrl;
}
