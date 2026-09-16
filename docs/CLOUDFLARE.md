# Cloudflare Workers 部署

本项目不是纯静态网页：浏览器端会调用 `/api` 创建房间、同步两人的选择并保存订单。因此 Cloudflare 上应创建 **Worker**，由 Worker 同时提供静态页面和 API；房间数据保存在 SQLite Durable Object 中。

## 从 GitHub 自动部署

在 Cloudflare 控制台进入 **Workers & Pages → 创建应用程序 → 导入存储库**，选择 `thk0426/codex-menu`。构建设置填写：

| 设置 | 值 |
| --- | --- |
| 项目类型 | Workers |
| 项目名称 | `codex-menu` |
| 生产分支 | `main` |
| 根目录 | `/`（仓库根目录） |
| 构建命令 | `pnpm run build` |
| 部署命令 | `pnpm exec wrangler deploy` |
| 环境变量 | 无需填写 |

Worker 项目不需要填写 Pages 的“构建输出目录”。`wrangler.jsonc` 已声明 Worker 入口、`dist` 静态资源、Durable Object 绑定和首次数据库迁移。首次发布时 Cloudflare 会自动创建所需的 Durable Object 命名空间。

如果当前失败的项目是 **Pages** 项目，建议返回“创建应用程序”，重新以 Workers 项目导入同一仓库。只把 `dist` 上传为 Pages 静态站点会导致页面能打开、双人同步接口却不可用。

部署完成后打开：

```text
https://你的域名/api/health
```

正确结果包含：

```json
{"ok":true,"runtime":"cloudflare-workers"}
```

随后在两个浏览器或一个普通窗口加一个无痕窗口中测试邀请、加入、点菜、下单和删除订单。每次推送 `main` 后，Cloudflare 会按相同设置重新构建和发布。

## 本地验证

```powershell
pnpm install --frozen-lockfile
pnpm run check:cloudflare
pnpm run dev:cloudflare
```

`pnpm run check:cloudflare` 会生成前端资源并执行 Wrangler 的完整打包检查，但不会发布。`pnpm run dev:cloudflare` 默认启动本地 Worker；服务启动后可在另一个终端运行 `pnpm run smoke:cloudflare`，验证静态页面、建房、远程加入、实时同步、下单和删除订单。

## 微信小程序连接线上服务

Cloudflare 发布完成后，将 `miniprogram/config.js` 中的 `apiBase` 改为实际的 `https://...workers.dev` 或自定义域名。在微信小程序后台把同一 HTTPS 域名加入 `request` 合法域名，再用两台真机验证远程同步。不要填写末尾斜杠，也不要继续使用 `127.0.0.1`。

## 常见失败原因

- 日志出现 `Missing script: build`：部署使用了旧提交，或 Cloudflare 选择了错误的分支/根目录。确认生产分支为 `main`、根目录为仓库根目录，并重试最新提交。
- 日志出现 `wrangler: command not found`：部署命令应为 `pnpm exec wrangler deploy`，依赖安装应使用仓库中的 `pnpm-lock.yaml`。
- 页面打开但 `/api/health` 为 404：项目被建成了 Pages 静态站点；改为 Workers 项目。
- Durable Object 绑定或迁移报错：确认部署命令使用仓库内的 `wrangler.jsonc`，不要在 Cloudflare 面板另设输出目录覆盖配置。
- Node 版本报错：将 Cloudflare 构建环境的 Node 版本设为 22；项目要求 Node 20 或更新版本。
