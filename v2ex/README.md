# V2EX 插件

本插件只注册 Agent 工具，不声明插件页面、对话卡片或其他 UI 能力。

## 安装与配置

在毛球插件库安装 `v2ex/`，再添加到需要使用的 Agent。首次调用时，App 会分别请求授权 `www.v2ex.com`（公开接口）和 `edge.v2ex.com`（账号接口）。

热门主题、经典最新主题、节点资料和公开用户资料免登录。其他工具需要在该 Agent 的插件配置中填写 V2EX Personal Access Token。令牌由 App 的 Keychain 保存；建议创建 `regular` 类型的令牌，并在到期后自行更新。插件不创建或回传新的令牌。

## 工具

| 范围 | 工具 |
| --- | --- |
| 免登录读取 | `hot_topics`、`latest_topics`、`node_info`、`member_info` |
| 账号读取 | `latest_topics_page`、`node_topics`、`topic`、`topic_replies`、`my_profile`、`notifications` |
| 账号操作 | `delete_notification`、`create_topic`、`create_reply`、`set_sticky`、`boost_topic` |

所有账号操作工具都声明 `requiresApproval`，App 会在每次调用前确认。V2EX 当前只向 PRO 会员开放 API 发帖和回帖；节点权限、发帖频率及铜币规则仍然生效。`boost_topic` 会消耗至少 100 铜币，部分旧主题费用更高。置顶和推广仅适用于自己创建的主题。

账号接口使用 V2EX 的 `edge.v2ex.com/api/v2`，因为官方 `edge` 文档列出发帖、回帖和分页全站最新等接口，而 `www` 文档尚未列出。公开接口使用 `www.v2ex.com/api`。API 2.0 仍为 Beta，实际权限及响应以 V2EX 返回结果为准；插件不会尝试网页抓取或调用未公开的搜索、收藏 API。

V2EX API 文档：[公开 API](https://www.v2ex.com/p/7v9TEc53)、[API 2.0](https://edge.v2ex.com/help/api)、[个人访问令牌](https://edge.v2ex.com/help/personal-access-token)。
