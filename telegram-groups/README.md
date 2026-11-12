# Telegram 群消息插件

通过 Telegram Bot API 的 `getUpdates` 读取机器人收到的群组新消息，并通过 `sendMessage` 向指定群组发文字。读取时每次最多返回 30 条，并保存下次读取的 `update_id`；如果返回 `has_more: true`，可以继续调用。读取过的群会出现在 App 的群组选择列表中。发送时必须提供负数群组 Chat ID 和完整正文，App 会在调用前请求用户确认。

1. 在 Telegram 的 [@BotFather](https://t.me/BotFather) 创建专用 Bot，取得 Token。
2. 将 Bot 加入要读取的群。若需要普通群消息，给 Bot 管理员权限，或在 BotFather 关闭 Group Privacy Mode 后重新加入群。请确保群成员知晓机器人能读取消息。
3. 把本目录打成 ZIP，在 App 的「插件库 → ＋ → 导入 ZIP」中安装；给目标 Agent 挂载「Telegram 群消息」插件。
4. 首次调用时填写 Bot Token。可选填数字 Chat ID 限定单个群；留空则读取这个 Bot 收到的所有群组。首次访问 `api.telegram.org` 时批准域名授权。
5. 让 Bot 在目标群收到至少一条消息，再调用 `read_new_messages` 发现群。发送时可调用 `choose_group` 在 App 中选择；如果配置了 Chat ID，该群也会出现在列表中。选择后仍会在发送前确认目标群 ID 和正文。发送结果为 `delivery_unknown` 时，先去群里确认，避免重复发送。

此插件只读取 Telegram 尚未过期的待处理更新，不能补读旧历史。Telegram 最多保留未读取更新 24 小时。这个 Bot 不应同时被 webhook 或其他 `getUpdates` 客户端消费，否则会冲突或丢失更新。插件读取进度属于当前 Agent 的插件数据；删除 Agent 或插件时由 App 清理。Token 保存在 App 的密钥存储中。
