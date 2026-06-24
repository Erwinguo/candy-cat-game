# 糖豆乐园 API

这是糖豆乐园的后端服务，负责登录、分数提交、排行榜和后续分享能力。

当前已实现：

- `GET /health`
- `POST /api/scores`
- `GET /api/leaderboard`
- `GET /api/leaderboard/me`
- Google / 微信登录入口预留

## 本地准备

安装 Node.js 22 LTS。

```bash
cd server
npm install
copy .env.example .env
```

把 `.env` 里的 `DATABASE_URL` 换成 Supabase 的 PostgreSQL 连接串。

## 初始化数据库

在 Supabase SQL Editor 里执行：

```sql
-- 粘贴 server/db/schema.sql 的内容
```

也可以用 psql：

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

## 启动

```bash
npm run dev
```

默认地址：

```text
http://localhost:8787
```

## 让前端连接 API

静态前端默认不连接 API。部署后可以在浏览器控制台临时设置：

```js
localStorage.setItem("tangdouApiBase", "https://你的-api-域名");
location.reload();
```

正式上线时，可以在 `index.html` 里加：

```html
<script>
  window.TANGDOU_API_BASE = "https://你的-api-域名";
</script>
```

## 部署建议

MVP 阶段：

- 前端：GitHub Pages
- 后端：Render / Fly.io / Railway
- 数据库：Supabase PostgreSQL

正式面向微信用户：

- 前端和后端都部署到备案域名
- 腾讯云 CVM 或轻量服务器
- Docker 运行 Node API
- PostgreSQL 可用 Supabase、腾讯云数据库或自建

## 后续登录

Google 登录：

- 可以接 Supabase Auth
- 或后端直接做 Google OAuth

微信登录：

- 需要微信开放平台网站应用
- 需要 AppID、AppSecret、授权回调域名
- 后端处理 OAuth 回调，再写入 `app_users`
