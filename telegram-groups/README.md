# Telegram 群消息插件

只读展示 Telegram Bot 收到的群消息、群资料、成员状态和入群申请记录。插件没有发送、回复、投票、批准申请或群管理工具，也不在卡片中提供操作按钮。卡片只使用 App 现有的通用组件。

## 配置

1. 在 Telegram 的 [@BotFather](https://t.me/BotFather) 创建专用 Bot，取得 Token。
2. 将 Bot 加入要读取的群。若需要普通群消息，给 Bot 管理员权限，或在 BotFather 关闭 Group Privacy Mode 后重新加入群。请确保群成员知晓机器人能读取消息。
3. 在 App 的插件库安装「Telegram 群消息」，挂载到目标 Agent，并填写 Bot Token。可选填数字 Chat ID 限定单个群；留空则读取这个 Bot 收到的所有群组。首次访问 `api.telegram.org` 时批准域名授权。
4. 让 Bot 在目标群收到消息，再调用 `read_new_messages`。读取结果会包含群组 ID，可用来查询群资料和成员状态。

## 展示内容

| 工具 | 展示内容 |
| --- | --- |
| `read_new_messages` | 本次收到的群消息，最多返回 30 条；卡片展示最近 5 条 |
| `get_group_info` | 群标题、描述、成员数和管理员；部分数据需要 Bot 有相应权限 |
| `get_member_status` | 指定用户的身份和发言权限；查询其他成员通常需要管理员权限 |
| `list_join_requests` | 最多 50 条 Bot 已收到的入群申请记录；卡片展示最近 5 条 |

入群申请卡片是历史接收记录，插件无法核实申请现在是否仍待处理。旧版插件保存的申请记录会继续作为接收记录展示。工具结果仍返回完整结构化数据；`card_shown` 表示卡片是否展示成功。

`read_new_messages` 每次最多处理 100 个更新并返回最多 30 条消息，使用 `update_id` 保存读取进度；如果返回 `has_more: true`，可以继续读取。Bot Token 无法补读旧历史，Telegram 只保留尚未过期的待处理更新。这个 Bot 不应同时由 webhook 或其他客户端消费更新。读取进度和申请记录属于当前 Agent 的插件数据；删除 Agent 或插件时由 App 清理。Token 保存在 App 的密钥存储中。
