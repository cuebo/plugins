# Cloudflare 插件

将本插件安装到 Agent 后，可在插件首页点“前往 Cloudflare 创建 Token”，登录 Cloudflare 后创建 API Token，再回到 Agent 的插件配置中填写。这个入口使用插件协议的通用网页跳转能力；令牌的权限选择、创建和复制由用户在 Cloudflare 页面完成。首次访问 `api.cloudflare.com` 时，App 会请求网络授权。插件首页可浏览域名与近 24 小时请求趋势，查看 DNS、Workers 和 Pages；Agent 也可调用 `zone_card` 在对话中显示可展开的域名卡片。数据来自 Cloudflare API，不使用示例值。

建议创建限制到需要管理的 Zone 和账户的 API Token。按实际使用的功能授予权限：

| 功能 | Token 权限 |
| --- | --- |
| 列出域名及状态 | Zone Read |
| 近 24 小时流量 | Analytics Read，适用于所选 Zone |
| 查询／管理 DNS | DNS Read／DNS Write |
| 清理指定 URL 缓存 | Cache Purge |
| 查询 Workers | Workers Scripts Read |
| 查询 Pages／重试部署 | Pages Read／Pages Write |

可参考 Cloudflare 的 [Zone API](https://developers.cloudflare.com/api/resources/zones/methods/list/)、[DNS API](https://developers.cloudflare.com/api/resources/dns/subresources/records/methods/list/)、[Analytics Token 文档](https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/)、[Workers API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/list/)、[Pages API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/list/) 和 [Pages 重试 API](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/retry/) 核对权限。只读场景不需要授予写权限。若令牌仅有账户级资源、无法列出 Zone，可在插件配置中填账户 ID 来查看 Workers 和 Pages。

首页按当前 Agent 选择域名；该选择只保存在此 Agent 的插件私有存储中。Token 保存在 App 的密钥配置中，不写入插件仓库或私有存储。页面只提供浏览和切换；DNS 新增／修改／删除、URL 缓存清理、失败 Pages 部署重试均通过 Agent 工具执行，并由 App 在调用前确认。

DNS 写操作首版限 A、AAAA、CNAME、TXT、MX。修改和删除需要先查询记录 ID；插件会在写入前再次读取目标，返回结果含 `accepted` 和可验证时的 `verified`。缓存清理只接受所选域名下的 1 至 10 个完整 URL；`accepted:true` 表示 Cloudflare 接受了请求，不代表已证明缓存内容消失。Pages 重试只接受当前 `latest_stage.status` 为 `failure` 的部署；返回提交状态，之后需重新查询最终结果。写请求遇到超时不会自动重试。

各模块分别处理缺少权限、空数据和 API 错误，其他可用模块仍会显示。流量卡片的边缘响应传输量采用 GraphQL Analytics API 的 `edgeResponseBytes`，不是源站入站或计费带宽。

本地模拟验证：

```sh
node cloudflare/main.test.js
python3 scripts/generate-index.py --check
```
