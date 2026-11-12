# Telegram 群消息插件

通过 Telegram Bot API 读取群组新消息、查看群与成员、回复消息和话题、发起投票，并执行受确认保护的群管理操作。读取时每次最多返回 30 条消息，并保存下次读取的 `update_id`；如果返回 `has_more: true`，可以继续调用。读取过的群会出现在 App 的群组选择列表中。

1. 在 Telegram 的 [@BotFather](https://t.me/BotFather) 创建专用 Bot，取得 Token。
2. 将 Bot 加入要读取的群。若需要普通群消息，给 Bot 管理员权限，或在 BotFather 关闭 Group Privacy Mode 后重新加入群。请确保群成员知晓机器人能读取消息。
3. 把本目录打成 ZIP，在 App 的「插件库 → ＋ → 导入 ZIP」中安装；给目标 Agent 挂载「Telegram 群消息」插件。
4. 首次调用时填写 Bot Token。可选填数字 Chat ID 限定单个群；留空则读取这个 Bot 收到的所有群组。首次访问 `api.telegram.org` 时批准域名授权。
5. 让 Bot 在目标群收到至少一条消息，再调用 `read_new_messages` 发现群。发送时可调用 `choose_group` 在 App 中选择；如果配置了 Chat ID，该群也会出现在列表中。选择后仍会在发送前确认目标群 ID 和正文。发送结果为 `delivery_unknown` 时，先去群里确认，避免重复发送。

## 工具与权限

| 工具 | 用途 | 条件 |
| --- | --- | --- |
| `get_group_info`、`get_member_status` | 查看群资料、人数、管理员和成员状态 | Bot 能访问目标群；查询其他成员的状态通常需要管理员权限 |
| `reply_message` | 根据读取结果的 `message_id` 回复；可指定 `message_thread_id` 发到话题 | Bot 可在群中发言 |
| `send_poll` | 普通投票；选项以每行一项提供，支持匿名与多选 | Bot 可在群中发投票 |
| `pin_message`、`unpin_message`、`delete_message` | 置顶、取消置顶、删除指定消息 | Bot 具有相应管理员权限；Telegram 对删除消息有时间限制 |
| `restrict_member`、`unrestrict_member`、`ban_member`、`unban_member` | 限制发言、解除限制、封禁和解封 | Bot 具有管理成员权限；限制发言只适用于超级群。Telegram 在超级群封禁时会清除该成员的历史消息 |
| `list_join_requests`、`approve_join_request`、`decline_join_request` | 查看已收到的入群申请并处理 | Bot 具有邀请用户权限；先调用 `read_new_messages` 收取申请 |

所有写操作都声明了 `requiresApproval`，App 在调用前请求确认。入群申请在当前 Agent 的插件数据中最多保存 50 条，处理成功后移除。`read_new_messages` 会订阅 `message` 和 `chat_join_request` 两类更新；这个 Bot 不应同时被其他客户端消费更新。

`send_message` 和 `reply_message` 默认发送纯文本。要使用 Telegram MarkdownV2，传入 `format: "MarkdownV2"`，并按 [Telegram 转义规则](https://core.telegram.org/bots/api#markdownv2-style)编写正文，例如 `*加粗*`；普通文字里的下划线、星号和括号等特殊字符需要转义。这不是自动转换通用 Markdown 的模式；格式无效时 Telegram 会拒绝发送。

此插件只读取 Telegram 尚未过期的待处理更新，不能补读旧历史。Telegram 最多保留未读取更新 24 小时。插件读取进度属于当前 Agent 的插件数据；删除 Agent 或插件时由 App 清理。Token 保存在 App 的密钥存储中。
