# Imgur

1. 在 Cuebo 的「插件库」中安装 Imgur，或从 `https://github.com/cuebo/plugins/tree/main/imgur` 导入。
2. 为 Agent 添加「插件」能力并启用 Imgur，在该 Agent 的插件配置中填写 Imgur 应用的 Client ID。可在 [Imgur API 文档](https://apidocs.imgur.com/)查看应用注册方式。
3. 在聊天中附带一张图片并发送「把这张图上传到 Imgur」。首次访问需要授权 `api.imgur.com`，每次上传都需要确认图片和目标地址。
4. 上传成功后，插件返回图片 ID 和可分享的 HTTPS 直链。通过 Client ID 上传的图片为匿名上传，获得链接的人可访问。

插件通过 Cuebo 的聊天附件接口发送 JPEG，每次处理一张图片，单张最多 20 MB。插件配置只需要 Client ID。
