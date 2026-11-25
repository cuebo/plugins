# Cuebo OAuth HTTPS 回调

`worker.js` 部署为 Cloudflare Worker `cuebo-oauth-relay`，自定义域名 `oauth.myservers.plus`。一般授权服务只能登记 HTTPS 回调时，可使用 `https://oauth.myservers.plus/<provider>`；Worker 将 `code`、`state` 或授权错误转交给 `cuebo://plugin-auth/<provider>`。

Notion 使用专用的 `/notion/authorize`、`/notion` 和 `/notion/token`：Worker 将 Cuebo 的 PKCE 挑战绑定到签名的短期授权票据，把 Notion 所需的 Client Secret 留在 Worker 中，向 Notion 换取或刷新令牌，再通过 HTTPS 返回给 App。设置 `NOTION_CLIENT_ID` 和 **Secret 类型**的 `NOTION_CLIENT_SECRET` 后才会启用这些路由。Worker 不持久化 Token，不接受其他跳转目标，也不向页面回显授权码。

修改代码后需将同一版本部署到 Cloudflare，并运行 `node infra/oauth-relay/worker.test.mjs`。部署后用无效示例授权码检查 HTTP 302 的 `Location`，不要让 HTTP 客户端跟随跳转；空参数应返回 400。Notion 的真实授权与刷新需用已注册的开发者连接联调。
