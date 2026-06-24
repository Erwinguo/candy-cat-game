import cors from "@fastify/cors";
import Fastify from "fastify";
import { config } from "./config.js";
import { pool } from "./db.js";
import { authRoutes } from "./routes/auth.js";
import { scoreRoutes } from "./routes/scores.js";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin(origin, callback) {
    if (!origin || config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} is not allowed`), false);
  },
  credentials: true,
});

app.get("/health", async () => {
  const db = await pool.query("select 1 as ok");
  return { ok: true, database: db.rows[0].ok === 1 };
});

await app.register(authRoutes);
await app.register(scoreRoutes);

const shutdown = async () => {
  await app.close();
  await pool.end();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: config.port, host: "0.0.0.0" });
