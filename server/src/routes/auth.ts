import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  signSession,
  verifySession,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  exchangeWeChatCode,
  fetchWeChatUserInfo,
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

const wechatCallbackQuerySchema = z.object({
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

function replyWithAuth(reply: any, token: string, redirectTarget: string) {
  return reply
    .setCookie("tangdou_token", token, {
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
    })
    .redirect(
      config.frontendOrigin +
        "?login=ok&token=" +
        encodeURIComponent(token),
    );
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // ═══════════════ Google OAuth ═══════════════

  app.get("/api/auth/google/start", async (request, reply) => {
    if (!config.googleClientId) {
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

  // ═══════════════ WeChat OAuth ═══════════════

  app.get("/api/auth/wechat/start", async (request, reply) => {
    if (!config.wechatAppId) {
      return reply.code(501).send({
        error: "not_configured",
        message:
          "Set WECHAT_APP_ID and WECHAT_APP_SECRET in server/.env to enable WeChat login.",
      });
    }

    const parsed = loginQuerySchema.safeParse(request.query);
    const state = parsed.success ? encodeState(parsed.data.redirect || "/") : "";

    // Use QR code login for desktop; in-WeChat browser auto-detection
    // could switch to snsapi_userinfo scope + oauth2/authorize endpoint.
    const ua = (request.headers["user-agent"] || "").toLowerCase();
    const isWeChat = ua.includes("micromessenger");

    const params = new URLSearchParams({
      appid: config.wechatAppId,
      redirect_uri: config.wechatRedirectUri,
      response_type: "code",
      scope: isWeChat ? "snsapi_userinfo" : "snsapi_login",
      state,
    });

    const endpoint = isWeChat
      ? "https://open.weixin.qq.com/connect/oauth2/authorize"
      : "https://open.weixin.qq.com/connect/qrconnect";

    return reply.redirect(`${endpoint}?${params.toString()}#wechat_redirect`);
  });

  app.get("/api/auth/wechat/callback", async (request, reply) => {
    const parsed = wechatCallbackQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_callback_params" });
    }

    try {
      const tokenData = await exchangeWeChatCode(parsed.data.code);
      const userInfo = await fetchWeChatUserInfo(
        tokenData.access_token,
        tokenData.openid,
      );

      const user = await upsertUser(
        "wechat",
        tokenData.unionid || tokenData.openid,
        userInfo.nickname,
        userInfo.headimgurl || null,
      );

      const token = await signSession(user.id);
      return replyWithAuth(reply, token, decodeState(parsed.data.state));
    } catch (err: any) {
      request.log.error(err, "WeChat OAuth callback failed");
      return reply.code(401).send({ error: "wechat_auth_failed", message: err.message });
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
    return {
      user: {
        id: row.id,
        provider: row.provider,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
      },
    };
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    return reply
      .clearCookie("tangdou_token", { path: "/" })
      .send({ ok: true });
  });
};
