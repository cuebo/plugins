# Notion 插件

让 Cuebo Agent 查找标题、读取已授权页面与数据源，并在用户确认后新建子页面或追加正文。Notion 只开放用户在 OAuth 授权页勾选的页面及其子页面；`search` 只按标题查找，不会全文搜索正文。

## 授权

1. 在 Notion Developer portal 创建 **OAuth / Any workspace** 公开连接，回调地址设为 `https://oauth.myservers.plus/notion`。配置至少 Read content；若启用写工具，再配置 Insert content 与 Update content。
2. 将公开 Client ID 写入 `plugin.json` 的 `oauth.clientID`，同时把 Client ID、Client Secret 分别设置为 `cuebo-oauth-relay` Worker 的 `NOTION_CLIENT_ID` 和 `NOTION_CLIENT_SECRET`。Secret 只能保存在 Worker 密钥中，不进入插件或 App。
3. 部署 `infra/oauth-relay/worker.js`。App 打开 `authorizationURL`；Worker 绑定 App 的 PKCE 参数、转到 Notion 授权页，随后将授权码返回 App，并在服务端完成换取/刷新令牌。Worker 不持久化用户令牌。
4. 在插件设置里连接 Notion。手动令牌仅供备用，建议优先使用网页授权。

当前 App 每个 Agent 的 Notion 插件保存一组连接；连接多个工作区需要扩展 App 的账号选择能力。Notion OAuth 的响应未提供 `expires_in`，Worker 返回 7 天作为 Cuebo 主动刷新间隔，刷新时覆盖旧的 refresh token。

## 工具

- `search`：按标题查询或列出最近编辑的页面与数据源，支持游标分页。
- `read_page`：获取页面属性与第一批正文块；深层嵌套用 `list_block_children`。
- `list_block_children`：读取任意已授权块的子块，支持分页。
- `query_data_source`：读取数据源条目及常见属性，支持分页。
- `create_page`：在指定页面下建子页面；写操作须经 App 确认。
- `append_page_text`：在指定页面尾部追加文本；写操作须经 App 确认。

请求固定使用 Notion API `2026-03-11` 版本，`429` 时返回清晰错误，调用方稍后重试。批量同步、正文全文索引、文件上传和多个工作区连接不在首版范围内。

验证：`node notion/main.test.js`、`node infra/oauth-relay/worker.test.mjs`、`python3 scripts/generate-index.py --check`。

参考：[Notion OAuth](https://developers.notion.com/guides/authorization/overview)、[连接能力](https://developers.notion.com/reference/capabilities)、[搜索接口](https://developers.notion.com/reference/post-search)。
