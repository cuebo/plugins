# Cloudflare 插件

将本插件安装到 Agent 后，在插件设置中选择「连接 Cloudflare」完成网页授权。App 使用授权码与 PKCE，通过 `oauth.myservers.plus/cloudflare` 将回调交回手机；授权令牌只保存在 App 钥匙串中，不交给插件脚本或回调 Worker。网页授权不可用时，也可在插件配置中填写手动 API Token。首次访问 `api.cloudflare.com` 时，App 会请求网络授权。插件只提供 Agent 工具，不提供独立界面或对话卡片；域名状态与近 24 小时流量由 `zone_overview` 返回纯数据，Agent 用文字说明结果。数据来自 Cloudflare API，不使用示例值。

网页授权请求以下 Cloudflare 权限，读写均包含；每次执行写入工具前，App 仍会确认具体操作。手动 Token 建议限制到需要管理的 Zone 和账户，并按实际使用的功能授予权限：

| 功能 | Token 权限 |
| --- | --- |
| 列出域名及状态 | Zone Read |
| 近 24 小时流量 | Analytics Read，适用于所选 Zone |
| 查询／管理 DNS | DNS Read／DNS Write |
| 清理指定 URL 缓存 | Cache Purge |
| 查询 Workers | Workers Scripts Read |
| 查询 Pages／重试部署 | Pages Read／Pages Write |

可参考 Cloudflare 的 [Zone API](https://developers.cloudflare.com/api/resources/zones/methods/list/)、[DNS API](https://developers.cloudflare.com/api/resources/dns/subresources/records/methods/list/)、[Analytics Token 文档](https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/)、[Workers API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/list/)、[Pages API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/list/) 和 [Pages 重试 API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/retry/) 核对权限。只读场景不需要授予写权限。查询 Workers 和 Pages 时可以在插件配置中填写账户 ID，也可以由 Agent 根据 `zones` 返回的账户 ID 传参。

需要操作域名时，Agent 先调用 `zones` 获取 Zone ID，再传给相应工具。手动 Token 保存在 App 的密钥配置中，不写入插件仓库或私有存储。DNS 新增／修改／删除、URL 缓存清理、失败 Pages 部署重试均通过 Agent 工具执行，并由 App 在调用前确认。Cloudflare 网页授权失效时在插件设置中重新连接；手动 Token 可独立清除。

DNS 写操作首版限 A、AAAA、CNAME、TXT、MX。修改和删除需要先查询记录 ID；插件会在写入前再次读取目标，返回结果含 `accepted` 和可验证时的 `verified`。缓存清理只接受指定域名下的 1 至 10 个完整 URL；`accepted:true` 表示 Cloudflare 接受了请求，不代表已证明缓存内容消失。Pages 重试只接受当前 `latest_stage.status` 为 `failure` 的部署；返回提交状态，之后需重新查询最终结果。写请求遇到超时不会自动重试。

各工具分别处理缺少权限、空数据和 API 错误。流量数据中的边缘响应传输量采用 GraphQL Analytics API 的 `edgeResponseBytes`，不是源站入站或计费带宽。

本地模拟验证：

```sh
node cloudflare/main.test.js
node infra/oauth-relay/worker.test.mjs
python3 scripts/generate-index.py --check
```
