# 界面组件演示

这个插件用于测试 cuebo 的原生插件 UI。首页、二级页、弹层和对话卡片都由同一个 [`main.js`](main.js) 定义，覆盖当前支持的 **34 种组件**。

## 安装

在 App 的「能力管理 → 插件库」中找到「界面组件演示」并安装；也可以选择「从网址下载」，填入：

```text
https://github.com/cuebo/plugins/tree/main/ui-showcase
```

然后在目标 Agent 的插件列表中添加它。进入该插件的配置页，点「打开插件界面」即可测试页面。无需账号、Token 或网络授权；图片和源码链接从 GitHub 加载。若要在**对话**中测试卡片，确保 Agent 启用了「界面展示」，然后让 Agent 调用 `show_ui_showcase`。

## 测试路线

| 页面 | 组件或行为 |
| --- | --- |
| 首页 | 图片、进度、标签、数值、网格导航、快捷弹层 |
| 排版与容器 | Text、Icon、Row、Stack、Card、List、Grid、Divider、Spacer、CodeBlock、Button |
| 数据与列表 | Value、CueboInfo、DescriptionList、CueboLinkList、Table |
| 图表与指标 | CueboMetrics、Progress、CircularProgress、SegmentedGauge、Chart、MultiLineChart、CueboChart |
| 交互与表单 | Toggle、Slider、ActionMenu、Tabs、Disclosure、Form、Confirm |
| 状态与反馈 | StateBlock、Toast、局部替换、动作后刷新、弹层 |

「状态与反馈」里的点击次数、「交互与表单」里的开关、滑块和表单结果只保存在**当前 Agent 的这个插件**下。重置按钮会先显示确认弹层，再清除这些演示数据。表单里的私密输入只用于检查 SecureField 的显示与输入，不会保存或展示。插件不会向外部服务发送表单内容。

更新时在 App 中重新安装相同目录的新版插件。示例页面使用固定脚本和固定动作，模型只通过插件工具请求展示对话卡片。
