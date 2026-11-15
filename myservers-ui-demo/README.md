# MyServers 原版 UI 演示

这个插件把 MyServers 插件仓库的完整组件演示放进 cuebo。`scripts/myservers-demo.js` 原样复制自 [`myservers-demo-nas/1.0.37/main.js`](https://github.com/my-servers/myservers-plugins/tree/main/plugins/myservers-demo-nas/1.0.37)；`main.js` 只增加在对话里打开演示卡片的工具。

演示包含 35 个组件示例，以及二级页面、弹层、图表、表单和点击动作。它只展示模拟数据，不连接 NAS。

## 安装和查看

1. 在 cuebo 的插件库中安装 `myservers-ui-demo`，或从 `https://github.com/cuebo/plugins/tree/main/myservers-ui-demo` 导入。
2. 在 Agent 的插件配置页添加该插件，打开插件即可进入演示页面。
3. 在对话里让 Agent 调用 `show_myservers_demo`，可以查看同一协议的对话卡片。

插件声明 `uiProtocol: "myservers-v1"`，使用 MyServers 的嵌套组件和动作 JSON。cuebo 的插件页与对话卡片共用同一个 MyServers 协议渲染入口。演示脚本保留原始页面和事件定义；展示样式由 cuebo 的 SwiftUI 渲染器实现。
