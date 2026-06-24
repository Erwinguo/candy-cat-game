import * as jose from "jose";
import { config } from "./config.js";

const alg = "HS256";
const secret = new TextEncoder().encode(config.jwtSecret);

export async function signSession(userId: string): Promise<string> {
  return await new jose.SignJWT({ sub: userId })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifySession(token: string): Promise<string | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

// ── Google ────────────────────────────────────────────

export interface GoogleUserInfo {
  sub: string;
  name: string;
  picture?: string;
  email?: string;
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo failed: ${res.status}`);
  }
  return res.json() as Promise<GoogleUserInfo>;
}

export async function exchangeGoogleCode(code: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

// ── WeChat ────────────────────────────────────────────

export interface WeChatTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
  unionid?: string;
}

export interface WeChatUserInfo {
  openid: string;
  nickname: string;
  sex: number;
  province: string;
  city: string;
  country: string;
  headimgurl: string;
  unionid?: string;
}

export async function exchangeWeChatCode(code: string): Promise<WeChatTokenResponse> {
  const res = await fetch("https://api.weixin.qq.com/sns/oauth2/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      appid: config.wechatAppId,
      secret: config.wechatAppSecret,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WeChat token exchange failed: ${res.status} ${text}`);
  }
  const data = await res.json() as WeChatTokenResponse & { errcode?: number; errmsg?: string };
  if (data.errcode) {
    throw new Error(`WeChat token error: ${data.errcode} ${data.errmsg}`);
  }
  return data;
}

export async function fetchWeChatUserInfo(
  accessToken: string,
  openid: string,
): Promise<WeChatUserInfo> {
  const res = await fetch(
    `https://api.weixin.qq.com/sns/userinfo?access_token=${encodeURIComponent(accessToken)}&openid=${encodeURIComponent(openid)}&lang=zh_CN`,
  );
  if (!res.ok) {
    throw new Error(`WeChat userinfo failed: ${res.status}`);
  }
  const data = await res.json() as WeChatUserInfo & { errcode?: number; errmsg?: string };
  if (data.errcode) {
    throw new Error(`WeChat userinfo error: ${data.errcode} ${data.errmsg}`);
  }
  return data;
}
