# cuebo 插件

这里存放可导入 cuebo App 的插件。**每个一级目录是一个独立插件**，目录内的 `plugin.json` 描述插件，`main.js` 实现工具；需要拆分脚本时可增加 `scripts/*.js`。

## 插件列表

App 读取根目录的 [`index.json`](index.json) 展示可安装插件。索引记录每个插件的 ID、名称、简介、版本、目录、工具数量和网络域名；插件清单和脚本仍分别放在各自目录。添加或更新插件后运行 `python3 scripts/generate-index.py`，用 `python3 scripts/generate-index.py --check` 检查索引是否同步。

| 目录 | 用途 | 导入地址 |
| --- | --- | --- |
| [`github/`](github/) | 查看仓库、Issue、PR，创建和修改 Issue、评论、创建和合并 PR | `https://github.com/cuebo/plugins/tree/main/github` |
| [`image-upload/`](image-upload/) | 将当前消息的图片上传到用户配置的 HTTPS 服务 | `https://github.com/cuebo/plugins/tree/main/image-upload` |
| [`telegram-groups/`](telegram-groups/) | 读取群消息、选群、回复、投票和群管理 | `https://github.com/cuebo/plugins/tree/main/telegram-groups` |

## 在 App 中安装

1. 打开「能力管理 → 插件库」，点右上角添加按钮，选择「从网址下载」。
2. 也可以直接在插件库顶部的仓库列表中选择插件并点「安装」；手动下载时粘贴上表中**插件目录**的链接。
3. 查看插件内容并确认导入，然后在 Agent 的插件列表中添加该插件。

仓库根目录有多个 `plugin.json`，不能作为单个插件包导入。App 会下载仓库 ZIP，再定位链接所指目录中的 `plugin.json` 和脚本文件。

编写插件前先看 [插件脚本规范](docs/plugin-api.md)：列出可读取的数据、`host` API、系统能力、用户授权和运行限制。

## 新增插件

在仓库根目录新建一个目录，例如 `my-plugin/`：

```text
plugins/
├── README.md
└── my-plugin/
    ├── plugin.json
    ├── main.js
    └── scripts/       # 可选
        └── helper.js
```

`plugin.json` 至少声明唯一的 `id`、`name`、`version`、`files` 和 `tools`。`files` 中写相对插件目录的脚本路径；仓库文件里的值可以留空，App 导入时会读取对应脚本并填入内容。`main.js` 用 `registerTool(name, function(argsJSON) { ... })` 注册与 `tools` 声明同名的工具，返回字符串；建议返回 JSON 字符串。可选的 `pe` 是注入 Agent 的插件使用说明，只写调用时需要的内容。

插件脚本运行在受限 JavaScript 环境中。可使用 `host.config`、`host.storage`、`host.choose`、`host.request`、`host.attachments`，以及在声明并启用对应能力后使用 `host.call` 调用浏览器或图片能力。声明 `generative_ui` 且 Agent 启用界面展示后，可用 `host.ui("show", JSON.stringify({id:"demo",title:"标题",components:[{id:"text",component:"Text",text:"内容"},{id:"root",component:"Column",children:["text"]}]}))` 展示 A2UI 卡片；同一轮用相同 ID 的 `host.ui("update", JSON.stringify({...}))` 更新。界面展示无需逐次弹窗授权，宿主会验证组件结构、大小及链接动作。网络请求通过 App 的 HTTPS 接口，首次访问未授权域名时自动请用户确认；同意后保存到该 Agent 的插件白名单。脚本不能直接使用 Node.js 或文件系统。不要把密钥写进仓库；需要密钥时使用 `config` 的 `secret` 字段，由用户在 App 中配置。

更新插件时递增 `version`，并在 App 中重新导入对应目录链接。公开插件请保持目录和 `id` 稳定，避免用户重新导入后出现两个不同插件。

## GitHub 插件

导入 `github/` 后，在 Agent 中添加 GitHub 插件，配置 GitHub 访问令牌。建议使用权限尽量小的 fine-grained personal access token：读取仓库需要相应仓库读取权限；创建 Issue 和评论需要 Issues 写权限；创建 Pull Request 需要 Pull requests 写权限。第一次连接 `api.github.com` 时 App 会请求网络授权。创建或修改 Issue、评论、创建或合并 PR 会再次确认具体操作。令牌保存在 App 的插件私有配置中，不要写入仓库或对话。

## Telegram 群消息插件

导入 `telegram-groups/` 后，给 Agent 配置专用 Bot Token，并把机器人加入目标群。读取工具会记录已发现的群，选择工具在 App 中展示群列表；回复、投票和群管理工具会在操作前请求确认。管理员操作需要给 Bot 相应权限。详细配置和读取限制见[插件说明](telegram-groups/README.md)。

## 图片上传示例

导入 [`image-upload/`](image-upload/) 后，配置 HTTPS 上传地址；需要鉴权时填写 Token、请求头和前缀。用户在当前消息附图并要求上传时，插件会列出本轮图片，再由 App 展示图片和目标地址供确认。详见[插件说明](image-upload/README.md)。
