# cuebo 插件脚本规范

本页描述当前 App **实际实现**的插件接口。插件是由 App 加载的 JavaScript 包；Agent 调用插件声明的工具，脚本再通过 `host` 请求受控的宿主能力。插件只会得到传给本次工具的参数，以及它主动调用 `host` 后返回的数据。

## 从最小插件开始

一个插件占仓库中的一个一级目录：

```text
my-plugin/
├── plugin.json
└── main.js
```

仓库中的 `plugin.json` 用 `files` 列出脚本路径，值可留空；App 安装时会下载脚本并填入源码：

```json
{
  "id": "my-plugin",
  "name": "示例插件",
  "description": "向指定名字打招呼",
  "pe": "需要向用户打招呼时调用 greet。",
  "version": "1.0.0",
  "files": { "main.js": "" },
  "tools": [{
    "name": "greet",
    "description": "按姓名生成问候语",
    "parameters": {
      "name": { "type": "string", "description": "姓名", "required": false }
    }
  }]
}
```

```js
registerTool("greet", function (argsJSON) {
  var args = JSON.parse(argsJSON || "{}");
  return JSON.stringify({ message: "你好，" + (args.name || "朋友") + "！" });
});
```

模型看到的工具名是 `plugin_my_plugin_greet`。`parameters` 支持 `string`、`number`、`boolean`，字段名映射到 `{type, description, required}`。工具的输入是 **JSON 字符串**，返回字符串；建议返回 JSON 字符串，方便模型判断成功和失败。每个 `tools[].name` 都必须对应同名 `registerTool`。

`id` 为 2–64 位小写字母、数字、连字符，且以字母开头；工具名可再包含下划线。`description` 用于列表，`pe` 是挂载后注入模型的使用说明。修改插件要递增 `version`。脚本可拆在 `scripts/*.js`，辅助脚本按路径排序先加载，`main.js` 最后加载。

## 能获取哪些数据

| 来源 | 插件能得到的数据 | 条件 |
| --- | --- | --- |
| 本次工具参数 | 模型传给该工具的 JSON 字符串 | 工具已声明，Agent 已挂载插件 |
| `host.config()` | 当前 **Agent 的这个插件**保存的配置值，包括用户填写的密钥 | 包内声明 `config`；用户保存配置 |
| `host.storage()` | 当前插件与当前 Agent 的私有 JSON 键值 | 使用插件自己的键；不能读别的插件或 Agent |
| `host.request()` | 用户允许的公网 HTTPS 域名返回的状态码、响应正文等 | 首次访问未授权域名时用户确认 |
| `host.call("browser.*", …)` | App **内置浏览器当前页面**的标题、URL、HTML、截图和操作结果 | 包声明 `wk_browser`，Agent 启用浏览器 |
| `host.call("photo.*", …)` | 当前对话最近一条用户消息里的图片及编辑预览、操作结果 | 包声明 `brightroom_photo`，Agent 启用图片编辑 |
| `host.ui("show"/"update", …)` | 在当前轮对话创建或更新 A2UI 卡片 | 包声明 `generative_ui`，Agent 启用界面展示 |
| `host.choose()` | 用户在选择弹层提交的选项或取消结果 | 仅插件工具，且工具声明 `onSelect` 回调 |
| Eino middleware | 对应钩子的消息、工具列表、调用参数或结果 | 包声明对应回调 |

普通工具不会自动收到完整聊天记录；但声明了 Eino middleware 的插件，其部分回调会收到本轮传给模型的 `messages`，可能包含对话上下文，应按敏感数据处理。插件目前**没有直接接口**读取其他插件数据、系统文件、剪切板、位置、日历、HomeKit、SSH 终端或运行环境命令。不能直接使用 Node.js、`require`、`fetch`、文件系统或任意系统命令。浏览器数据来自 cuebo 的内置浏览器，不是 Safari 或其他浏览器的登录数据。

## 配置：`host.config()`

包内声明配置字段：

```json
"config": [
  { "id": "token", "title": "访问令牌", "type": "secret", "required": true },
  { "id": "verbose", "title": "详细输出", "type": "boolean" }
]
```

```js
var config = JSON.parse(host.config());
var token = config.token;                  // 用户填写的密钥
var verbose = config.verbose === "true";  // 配置值都是字符串
```

字段类型为 `text`、`secret`、`boolean`、`select`；`select` 还需 `options` 字符串数组。最多 32 项。未保存的字段不会自动填默认值；`host.config()` 可能返回 `{}`。必填字段缺失时，首次调用工具会先让用户配置。`secret` 由 App 保存到 Keychain；脚本可以读取后用于请求，但不要写进脚本、工具结果、日志或仓库。`onConfigSaved` 可指向 `registerCallback` 注册的函数，配置保存后由运行时通知它。

## 私有数据：`host.storage(action, key, value)`

```js
var previous = JSON.parse(host.storage("get", "counter")); // 不存在时返回 "null"
var count = (previous || 0) + 1;
var saved = JSON.parse(host.storage("put", "counter", JSON.stringify(count)));
// saved: {"saved":true}
var deleted = JSON.parse(host.storage("delete", "counter"));
// deleted: {"deleted":true}
```

动作只有 `get`、`put`、`delete`；写入是 `put`，不是 `set`。键只允许字母、数字、`_`、`-`，最长 120 字符，不允许目录路径；值必须是合法 JSON，单值最多 256 KB。数据以插件 ID 和 Agent ID 隔离，卸载插件或清理 Agent 数据时由 App 清理。检查返回的 `{error: ...}`，不要把“函数存在”当作读写成功。

## 网络：`host.request(requestJSON)`

```js
var response = JSON.parse(host.request(JSON.stringify({
  method: "GET",
  url: "https://api.example.com/items",
  headers: { "Accept": "application/json" }
})));
if (response.status < 200 || response.status >= 300) {
  return JSON.stringify({ ok: false, status: response.status, body: response.body });
}
return response.body; // 需要结构化内容时再 JSON.parse(response.body)
```

请求对象支持 `method`（省略为 `GET`，另支持 `POST`、`PATCH`、`PUT`、`DELETE`）、`url`、`headers`、文本 `body`，或二进制 `bodyBase64`；两种 body 不能同时使用。返回 JSON 字符串，字段为 `status`、`contentType`、`link` 和 `body`；非 UTF-8 响应改用 `bodyBase64`。HTTP 4xx/5xx 也会返回状态码和正文，脚本应自行判断。连接或权限错误则会抛出宿主错误。

只能访问公网 HTTPS 域名，端口为默认 443；禁止 IP、`localhost`、`.local`、私网地址和跳转跟随。请求正文最多 256 KB，响应正文最多 1 MB，超时 20 秒。不能设置 `Host`、`Cookie`、`Proxy-Authorization` 等受保护请求头。

可在包内列出预计访问的域名：`"networkHosts": ["api.example.com"]`（最多 8 个）。这只是供用户了解和预授权，**不是插件自授予权限**。调用未授权域名时，App 自动展示插件名与域名；用户同意后按插件和 Agent 加白，后续请求直接使用，用户可在插件详情撤销。插件版本或脚本变化后需重新授权。无需为每个插件各写一套授权弹窗。域名获准后，插件能够把它已读取的配置、对话上下文或其他数据发往该域名；只安装和授权可信插件。

## 调用系统能力：`host.call(action, argsJSON)`

包声明 `capabilities`，且 Agent 同时启用对应能力后才可调用。返回值是 JSON 字符串；正常结果通常有 `text`，图片结果有 `image`（`data:image/jpeg;base64,...`），失败有 `error`。脚本应检查 `error`。

| 包内声明 | 动作 | 可用输入与数据 |
| --- | --- | --- |
| `"wk_browser"` | `browser.open`、`browser.html`、`browser.image`、`browser.click`、`browser.type`、`browser.scroll`、`browser.back` | `open` 用 `{url}`；`html` 读取当前页面标题、URL 和最多 50,000 字符的 HTML；`image` 返回截图；点击用 CSS `selector` 或 `{x,y}`；输入用 `{selector,text}`；滚动用 `{deltaY}` |
| `"brightroom_photo"` | `photo.open`、`photo.adjust`、`photo.crop`、`photo.rotate`、`photo.undo`、`photo.image`、`photo.export` | `open` 用 `{imageIndex:1}` 打开当前对话图片；后续可调整、裁剪、旋转、撤销；`image` 返回编辑预览；`export` 把完整尺寸结果加入对话 |

```json
"capabilities": ["wk_browser"]
```

```js
var opened = JSON.parse(host.call("browser.open", JSON.stringify({url:"https://example.com"})));
if (opened.error) return JSON.stringify({ok:false,error:opened.error});
var page = JSON.parse(host.call("browser.html", "{}"));
return JSON.stringify({ok:!page.error,text:page.text,error:page.error});
```

`browser.open` 是 App 内置浏览器操作，可以打开 HTTP/HTTPS 网页；它和 `host.request` 的独立 HTTPS 网络接口用途不同。当前 `host.call` **只接通浏览器与图片编辑**；界面展示使用单独的 `host.ui`。

## 创建和更新对话卡片：`host.ui(action, cardJSON)`

在 `plugin.json` 声明 `"capabilities": ["generative_ui"]`，当前 Agent 还须启用“界面展示”能力。插件工具和 Eino 回调都可以调用 `host.ui`；它只操作**当前轮对话里的卡片**，不能修改 App 其他页面。`cardJSON` 是 JSON 字符串，成功返回 JSON 字符串 `{"ok":true}`。展示卡片本身不弹授权窗。

```js
var card = {
  id: "demo-card",
  title: "Demo 卡片",
  components: [
    {id: "title", component: "Text", text: "Demo 卡片", variant: "h3"},
    {id: "content", component: "Text", text: "初始内容", variant: "body"},
    {id: "root", component: "Column", children: ["title", "content"]}
  ]
};
var shown = JSON.parse(host.ui("show", JSON.stringify(card)));
card.components[1].text = "更新后的内容";
var updated = JSON.parse(host.ui("update", JSON.stringify(card)));
```

先 `show`，同一轮才能用相同 `id` 执行 `update`；后者替换**整张卡片**，不是局部节点补丁。重复 `show` 同一 ID 会报错，下一轮需重新 `show`。卡片 ID 在插件间隔离。`id` 以英文字母开头，后续可用英文字母、数字、下划线和连字符，最长 64 字符。`title` 必填，最多 80 字；可选的 `subtitle` 最多 200 字。

`components` 是 A2UI v0.9 的扁平节点数组：每个节点有唯一 `id` 和 `component`，必须包含 `root`；`Row`、`Column`、`List` 用 `children` 引用节点 ID，`Card`、`Button` 用 `child` 引用节点 ID。支持 `Text`、`Image`、`Icon`、`Row`、`Column`、`List`、`Card`、`Divider`、`Button`、`CueboMetrics`、`CueboInfo`、`CueboLinkList`、`CueboChart`。最多 80 个节点，单次请求不超过 64 KB。`Button` 目前只能使用 `{event:{name:"open_url",context:{url:"https://example.com"}}}` 打开网页，点击不会回调插件；没有通用表单输入或任意原生页面控制。工具返回给模型的结果仍应包含有用的状态和数据，不能只返回 `{ok:true}`。

展示和更新同一张卡片时，应在同一轮按先后顺序调用 `host.ui("show", ...)` 和 `host.ui("update", ...)`，并使用相同的卡片 ID。

## 用户交互与操作确认

`host.choose(JSON.stringify(request))` 在半弹层展示选择项。实际调用它的工具须声明 `onSelect`，对应 `registerCallback` 注册的函数：

```json
"tools": [{"name":"pick","description":"选择颜色","onSelect":"receiveChoice"}]
```

```js
registerCallback("receiveChoice", function (responseJSON) {
  var response = JSON.parse(responseJSON);
  return JSON.stringify({cancelled: response.cancelled, selections: response.selections});
});
registerTool("pick", function () {
  return host.choose(JSON.stringify({
    title: "选择颜色",
    tabs: [{id:"color",title:"颜色",mode:"single",options:[
      {id:"blue",label:"蓝色"},{id:"green",label:"绿色"}
    ]}]
  }));
});
```

请求支持 `title`、`description`、`tabs`（1–8 项）、`allow_custom_input`；每个标签的 `mode` 为 `single` 或 `multiple`，选项有 `id`、`label`、`description`。回执包含 `cancelled`、`selections`（每项含 `tab_id`、`option_ids`）、可选 `custom_input`。用户提交或取消后，`onSelect` 的返回值直接作为工具结果；不要依赖 `host.choose` 后面的语句继续拼装结果。middleware 回调不支持 `host.choose`。

会修改外部数据的工具可声明 `"requiresApproval": true`，App 在调用该工具前向用户确认。网络域名授权与工具操作确认是两件事：例如 GitHub 插件首次访问 API 会确认域名，创建 Issue 会确认这次工具调用。

## Eino middleware 回调

`middleware` 把 Eino 钩子名映射到 `registerCallback` 注册的函数名：

```json
"middleware": {"BeforeAgent":"beforeAgent","WrapInvokableToolCall":"aroundTool"}
```

每个回调接收一个 **JSON 字符串**，返回 JSON 对象或其 JSON 字符串；无修改时返回 `{}`。当前支持：

| 钩子 | 输入与可返回的修改 |
| --- | --- |
| `BeforeAgent` | 输入 `instruction`、`pluginID`；可返回 `appendInstruction` |
| `AfterAgent` | 输入 `messages`；仅 Agent 成功结束时运行，返回值不注入下一轮 |
| `BeforeModelRewriteState`、`AfterModelRewriteState` | 输入 `messages`、`toolInfos`、`deferredToolInfos`；可返回同名字段修改。工具列表只能筛选已有项，不能新增工具 |
| `WrapInvokableToolCall` | `phase=before` 时输入/修改 `arguments`；`phase=after` 时输入/修改 `result` |
| `WrapStreamableToolCall` | `phase=before` 修改 `arguments`；`phase=chunk` 修改 `result` |
| `WrapEnhancedInvokableToolCall` | `phase=before` 修改 `argument`；`phase=after` 修改 `result` |
| `WrapEnhancedStreamableToolCall` | `phase=before` 修改 `argument`；`phase=chunk` 修改 `result` |
| `WrapModel` | `phase=before` 修改 `messages`；`phase=after` 或 `chunk` 修改 `message` |

工具包装只作用于**本插件注册的工具**。钩子可用 `host.config`、`host.storage`、`host.request`，也可在满足能力声明时用 `host.call`。每次回调使用独立 JS 环境，跨回调状态需显式存到 `host.storage`。

## 运行与发布边界

- 工具脚本连续运行限约 5 秒，middleware 回调限约 1 秒；等待宿主操作时计时暂停。最多 20 个工具、32 个配置项、32 个脚本文件，每个脚本最多 256 KB。
- 插件安装时会校验脚本语法、工具注册、回调名称和能力声明。包不能自带 `approvedNetworkHosts`，也不能自己扩大 Agent 的能力开关。
- 运行时每次调用创建新的 JavaScript 环境，不能靠全局变量保存长期状态。普通宿主错误可 `try/catch`；用户选择的中断由运行时恢复，不能当普通异常吞掉。
- 仓库根目录的 [`index.json`](../index.json) 是 App 展示插件列表用的元信息，不是可执行插件包。更新 `plugin.json` 后运行 `python3 scripts/generate-index.py`，再用 `--check` 校验索引。App 点击安装时只下载所选目录的清单和脚本，并再次运行包校验。
