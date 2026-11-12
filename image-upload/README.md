# 图片上传示例

将 `plugin.json` 和 `main.js` 作为一个插件包导入。配置服务的 HTTPS 上传地址；如需鉴权，将 Token 填在 `secret` 字段。默认发送 `Authorization: Bearer <Token>`；将请求头改为 `X-API-Key` 时默认发送原始 Token，也可设置自定义前缀。

在聊天消息中附图并要求插件上传。`host.attachments("list", "{}")` 仅列出本轮用户消息的图片引用，不返回文件路径或内容。`host.attachments("upload", ...)` 先走域名授权，再展示图片预览和目标 URL 供用户逐次确认。确认后由 App 提供文件，Go 侧用 `multipart/form-data` 的 `image` 字段上传；插件只收到状态码和响应内容。

插件不会持有图片副本。图片继续由所属会话管理，删除会话时按原有生命周期清理。
