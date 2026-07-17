# 糖豆乐园 API

这是糖豆乐园的后端服务，负责登录、分数提交、排行榜和分享能力。

当前已实现：

- `GET /health`
- `POST /api/auth/guest`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/me`
- `POST /api/auth/logout`
- `POST /api/scores`
- `GET /api/leaderboard`
- `GET /api/leaderboard/me`
- `POST /api/shares`

## 本地准备

安装 Node.js 22 LTS。

```bash
cd server
npm install
copy .env.example .env
```

把 `.env` 里的 `DATABASE_URL` 换成 PostgreSQL 连接串。正式启用 Google 登录时，还需要填写 Google Cloud OAuth Client 的：

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```

本地默认回调地址：

```text
http://localhost:8787/api/auth/google/callback
```

## 初始化数据库

在 PostgreSQL 中执行：

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

静态前端默认读取 `config.js` 中的 `window.TANGDOU_API_BASE`。本地 Docker 版本会自动生成：

```js
window.TANGDOU_API_BASE = "http://localhost:8787";
```

如果手动预览静态页面，也可以在浏览器控制台临时设置：

```js
localStorage.setItem("tangdouApiBase", "http://localhost:8787");
location.reload();
```

## 部署建议

MVP 阶段：

- 前端：GitHub Pages
- 后端：Render / Fly.io / Railway / 云服务器
- 数据库：PostgreSQL

如果前后端同域部署，可以用 Docker Compose 运行 PostgreSQL、API 和 Nginx 前端容器；如果前端继续放在 GitHub Pages，记得把 API 的 `CORS_ORIGIN` 加上 GitHub Pages 域名。
