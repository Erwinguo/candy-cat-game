import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  signSession,
  verifySession,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
} from "../auth.js";
import { config } from "../config.js";
import { query } from "../db.js";

const googleLoginQuerySchema = z.object({
  redirect: z.string().optional(),
});

const googleCallbackQuerySchema = z.object({
  code: z.string(),
  state: z.string().optional(),
});

type AppUserRow = {
  id: string;
  provider: string;
  provider_user_id: string;
  display_name: string;
  avatar_url: string | null;
};

async function upsertUser(
  provider: string,
  providerUserId: string,
  displayName: string,
  avatarUrl: string | null,
): Promise<AppUserRow> {
  const result = await query<AppUserRow>(
    `
      insert into app_users (provider, provider_user_id, display_name, avatar_url)
      values ($1, $2, $3, $4)
      on conflict (provider, provider_user_id)
      do update set display_name = excluded.display_name,
                    avatar_url = excluded.avatar_url,
                    updated_at = now()
      returning id, provider, provider_user_id, display_name, avatar_url
    `,
    [provider, providerUserId, displayName, avatarUrl],
  );
  return result.rows[0];
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Google OAuth start - redirect to Google
  app.get("/api/auth/google/start", async (request, reply) => {
    if (!config.googleClientId) {
      return reply.code(501).send({
        error: "not_configured",
        message:
          "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env to enable Google login.",
      });
    }

    const parsed = googleLoginQuerySchema.safeParse(request.query);
    const state = parsed.success && parsed.data.redirect
      ? Buffer.from(parsed.data.redirect).toString("base64url")
      : "";

    const params = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: config.googleRedirectUri,
      response_type: "code",
      scope: "openid profile email",
      state,
    });

    return reply.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    );
  });

  // Google OAuth callback
  app.get("/api/auth/google/callback", async (request, reply) => {
    const parsed = googleCallbackQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_callback_params" });
    }

    try {
      const accessToken = await exchangeGoogleCode(parsed.data.code);
      const userInfo = await fetchGoogleUserInfo(accessToken);
      const user = await upsertUser(
        "google",
        userInfo.sub,
        userInfo.name,
        userInfo.picture ?? null,
      );

      const token = await signSession(user.id);

      // Determine redirect target
      let redirectUrl = "/";
      if (parsed.data.state) {
        try {
          redirectUrl = Buffer.from(parsed.data.state, "base64url").toString("utf-8");
        } catch {
          redirectUrl = "/";
        }
      }

      return reply
        .setCookie("tangdou_token", token, {
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60, // 7 days
        })
        .redirect(config.frontendOrigin + "?login=ok&token=" + encodeURIComponent(token));
    } catch (err: any) {
      request.log.error(err, "Google OAuth callback failed");
      return reply.code(401).send({ error: "google_auth_failed", message: err.message });
    }
  });

  // WeChat login - still stub
  app.get("/api/auth/wechat/start", async (_request, reply) => {
    return reply.code(501).send({
      error: "not_configured",
      message:
        "WeChat login needs a WeChat Open Platform app id, app secret, and callback domain.",
    });
  });

  // Get current user
  app.get("/api/me", async (request) => {
    const cookie = request.cookies?.tangdou_token;
    const header =

request.headers.authorization?.replace(/^Bearer\s+/i, "");
    const rawToken = cookie || header;

    if (!rawToken) {
      return { user: null };
    }

    const userId = await verifySession(rawToken);
    if (!userId) {
      return { user: null };
    }

    const result = await query<AppUserRow>(
      `select id, provider, provider_user_id, display_name, avatar_url from app_users where id = $1`,
      [userId],
    );

    if (!result.rowCount) {
      return { user: null };
    }

    const row = result.rows[0];
    return {
      user: {
        id: row.id,
        provider: row.provider,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
      },
    };
  });

  // Logout
  app.post("/api/auth/logout", async (_request, reply) => {
    return reply
      .clearCookie("tangdou_token", { path: "/" })
      .send({ ok: true });
  });
};
