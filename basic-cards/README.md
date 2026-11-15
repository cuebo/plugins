# 基础卡片

此插件随 cuebo App 打包，首次启动安装到插件库。它与普通插件使用同一套工具注册、界面渲染和动作链路；App 内脚本只读，用户卸载后不会自动重新安装。从插件商店重新安装时使用 App 随附的脚本。

五个工具分别展示网页链接、指标、饼图、折线图和柱状图。Agent 只传内容数据，`main.js` 按固定模板生成 MyServers 组件树；列表与指标不显示卡片级标题和副标题。对话卡片和插件页面共用 `myservers-v1` 组件协议及渲染器。

打开基础卡片的插件界面，直接展示 35 个组件示例；点选示例可查看半弹层、组件和 JSON 代码。`scripts/myservers-demo.js` 复制自 [MyServers NAS 演示脚本](https://github.com/my-servers/myservers-plugins/tree/main/plugins/myservers-demo-nas/1.0.37)，`main.js` 提供五个对话工具并把演示列表接入插件首页。需要修改内置版本时，同时更新 App 的 `ios/Resources/BasicCards.bundle/`，并递增 `plugin.json` 的版本号。
