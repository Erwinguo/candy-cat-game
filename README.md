# 糖豆乐园

糖豆乐园是一个糖果三消小游戏。当前前端是静态网页，可以部署在 GitHub Pages；后端 API 已开始搭建，用于后续登录、排行榜、数据库和分享。

## 目录

```text
index.html          静态游戏入口
styles.css          游戏样式
game.js             游戏逻辑
assets/             封面和糖豆头像
server/             Node.js + TypeScript API
```

## 静态版

直接打开本地预览：

```bash
python -m http.server 5501
```

访问：

```text
http://127.0.0.1:5501/index.html
```

线上静态版：

```text
https://erwinguo.github.io/candy-cat-game/
```

## 后端路线

推荐栈：

- Node.js + TypeScript + Fastify
- PostgreSQL，MVP 用 Supabase
- GitHub Pages 承载静态前端
- Render / Fly.io / Railway 承载 API
- 后续国内和微信场景再迁移到腾讯云 + Docker

后端说明见 [server/README.md](server/README.md)。
