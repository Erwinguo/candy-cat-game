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

const loginQuerySchema = z.object({
  redirect: z.string().optional(),
});

const googleCallbackQuerySchema = z.object({
  code: z.string(),
  state: z.string().optional(),
});

const guestLoginSchema = z.object({
  clientId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(16),
  avatarUrl: z.enum([
    "assets/avatars/peach-cat.svg",
    "assets/avatars/mint-bunny.svg",
    "assets/avatars/lemon-bear.svg",
    "assets/avatars/grape-fox.svg",
  ]),
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

function decodeState(raw: string | undefined): string {
  if (!raw) return "/";
  try {
    return Buffer.from(raw, "base64url").toString("utf-8");
  } catch {
    return "/";
  }
}

function encodeState(url: string): string {
  return Buffer.from(url).toString("base64url");
}

function buildAuthRedirect(token: string, redirectTarget: string): string {
  let url: URL;
  try {
    url = new URL(redirectTarget, config.frontendOrigin);
    const allowedOrigin = new URL(config.frontendOrigin).origin;
    if (url.origin !== allowedOrigin) {
      url = new URL(config.frontendOrigin);
    }
  } catch {
    url = new URL(config.frontendOrigin);
  }

  url.searchParams.set("login", "ok");
  url.searchParams.set("token", token);
  return url.toString();
}

function replyWithAuth(reply: any, token: string, redirectTarget: string) {
  return reply
    .setCookie("tangdou_token", token, {
      path: "/",
      httpOnly: true,
      secure: config.frontendOrigin.startsWith("https://"),
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
    })
    .redirect(buildAuthRedirect(token, redirectTarget));
}

function userResponse(user: AppUserRow) {
  return {
    id: user.id,
    provider: user.provider,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
  };
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // ═══════════════ Username + avatar login ═══════════════

  app.post("/api/auth/guest", async (request, reply) => {
    const parsed = guestLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_guest_profile",
        details: parsed.error.flatten(),
      });
    }

    const user = await upsertUser(
      "guest",
      parsed.data.clientId,
      parsed.data.displayName,
      parsed.data.avatarUrl,
    );
    const token = await signSession(user.id);

    return reply
      .setCookie("tangdou_token", token, {
        path: "/",
        httpOnly: true,
        secure: config.frontendOrigin.startsWith("https://"),
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
      })
      .send({ token, user: userResponse(user) });
  });

  // ═══════════════ Google OAuth ═══════════════

  app.get("/api/auth/google/start", async (request, reply) => {
    if (!config.googleClientId || !config.googleClientSecret) {
      return reply.code(501).send({
        error: "not_configured",
        message:
          "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in server/.env to enable Google login.",
      });
    }

    const parsed = loginQuerySchema.safeParse(request.query);
    const state = parsed.success ? encodeState(parsed.data.redirect || "/") : "";

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
      return replyWithAuth(reply, token, decodeState(parsed.data.state));
    } catch (err: any) {
      request.log.error(err, "Google OAuth callback failed");
      return reply.code(401).send({ error: "google_auth_failed", message: err.message });
    }
  });

  // ═══════════════ User Info ═══════════════

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
    return { user: userResponse(row) };
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    return reply
      .clearCookie("tangdou_token", { path: "/" })
      .send({ ok: true });
  });
};
