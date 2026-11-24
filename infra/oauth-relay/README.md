# Cuebo OAuth HTTPS 回调

`worker.js` 部署为 Cloudflare Worker `cuebo-oauth-relay`，自定义域名 `oauth.myservers.plus`。授权服务只能登记 HTTPS 回调时，可使用 `https://oauth.myservers.plus/<provider>`；Worker 将 `code`、`state` 或授权错误转交给 `cuebo://plugin-auth/<provider>`。Worker 不存储 Token，不接受其他跳转目标，也不向页面回显授权码。

修改代码后需将同一版本部署到 Cloudflare，并运行 `node infra/oauth-relay/worker.test.mjs`。部署后用无效示例授权码检查 HTTP 302 的 `Location`，不要让 HTTP 客户端跟随跳转；空参数应返回 400。
