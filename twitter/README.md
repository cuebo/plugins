# X / Twitter 插件

将本目录作为插件从 `cuebo/plugins` 安装到 Agent。公开帖子、线程、主页、用户时间线和趋势无需账号配置；首次使用需在 App 中允许访问 `api.fxtwitter.com`。这些读取调用由开源 [FxEmbed](https://github.com/FxEmbed/FxEmbed) 提供，是第三方公开数据快照，可能延迟、缺失或受其服务状态影响。FxEmbed 的搜索接口目前标为不可用，因此插件不把它当成搜索来源。

`search_posts` 和账号工具使用 [X 官方 API](https://docs.x.com/x-api)。在 [X Developer Console](https://console.x.com/) 创建开发者项目并检查余额和接口权限，然后按需填写：

- `app_bearer_token`：App Bearer Token，供官方近期帖子搜索使用。也可以用有相应权限的 OAuth 2.0 用户令牌搜索。
- `user_token`：**OAuth 2.0 User Access Token**，供当前账号资料、收藏、发帖、点赞和转发使用。它需要对应的读写 scope。这个字段不是 OAuth 1.0a 的 Access Token，也不是账号密码或浏览器 Cookie。

当前版本的 App 插件 OAuth 网页连接需要在清单里固定公共 Client ID；此仓库没有 X 开发者应用的 Client ID，所以此插件使用手动令牌配置。OAuth 2.0 用户令牌到期后需在插件设置更新。官方 API [按读取资源或写入请求计费](https://docs.x.com/x-api/getting-started/pricing)，并受项目额度及接口权限约束。`my_bookmarks` 和点赞等账号操作先通过 `/2/users/me` 取得当前账号 ID，因此会增加一次官方读取请求。

所有写操作都在清单里声明 `requiresApproval`，由 App 执行前确认。插件不收集密码，不调用网页抓取服务执行账号操作，不把令牌写进工具结果。外部帖子及用户简介仅作为数据处理。

参考实现：开源 [node-twitter-api-v2](https://github.com/PLhery/node-twitter-api-v2) 展示了 OAuth 与官方 API 的封装方式；该库依赖 Node.js，不能在 App 的 Goja 插件运行时直接导入。插件仅使用 App 提供的 `host.request`，直接访问已核对的 HTTP API。

本地检查：

```sh
node twitter/main.test.js
python3 scripts/generate-index.py --check
```
