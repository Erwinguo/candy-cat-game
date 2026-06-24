import type { FastifyPluginAsync } from "fastify";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/auth/google/start", async (_request, reply) => {
    return reply.code(501).send({
      error: "not_configured",
      message: "Google login is reserved for the next step. We will connect Supabase Auth or Google OAuth here.",
    });
  });

  app.get("/api/auth/wechat/start", async (_request, reply) => {
    return reply.code(501).send({
      error: "not_configured",
      message: "WeChat login needs a WeChat Open Platform app id, app secret, and callback domain.",
    });
  });

  app.get("/api/me", async () => {
    return { user: null };
  });
};
