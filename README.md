# 糖豆乐园

糖豆乐园是一个糖果三消小游戏：前端可独立静态运行，也可以连接 Node.js API 使用登录、排行榜、成绩提交和分享海报功能。

## 目录

```text
index.html          游戏入口
styles.css          游戏样式
game.js             游戏逻辑
config.js           前端 API 地址配置
assets/             封面、糖豆形象和头像素材
server/             Node.js + TypeScript API
docker/             前端容器配置
docker-compose.yml  本地 Docker 编排
```

## 静态预览

```powershell
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

## Docker 本地动态版

需要 Docker Desktop。首次运行会构建前端、API 和 PostgreSQL 容器。

```powershell
$env:DOCKER_CONFIG = (Join-Path (Get-Location) '.docker-local')
docker compose -p tangdou up --build -d
```

访问：

```text
游戏页面：http://localhost:18080
API 健康检查：http://localhost:8787/health
```

常用命令：

```powershell
$env:DOCKER_CONFIG = (Join-Path (Get-Location) '.docker-local')
docker compose -p tangdou ps
docker compose -p tangdou logs -f api
docker compose -p tangdou down
```

数据保存在 Docker volume `tangdou_tangdou-db-data` 中。需要完全重置本地数据时再执行：

```powershell
$env:DOCKER_CONFIG = (Join-Path (Get-Location) '.docker-local')
docker compose -p tangdou down -v
```

## 当前动态功能

- Google OAuth 登录。
- 自行输入用户名并选择头像登录。
- 登录后提交成绩，排行榜按每个用户最佳成绩排名。
- 游戏结束后生成包含头像、分数和排名的分享海报。

## 后端路线

当前推荐栈：

- Node.js + TypeScript + Fastify
- PostgreSQL
- 本地开发使用 Docker Compose
- 线上 API 可部署到 Render / Fly.io / Railway / 云服务器
- 静态前端可继续使用 GitHub Pages，也可以和 API 一起用 Nginx 容器发布

后端说明见 [server/README.md](server/README.md)。
