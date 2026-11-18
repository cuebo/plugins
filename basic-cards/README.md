# 基础卡片

插件商店的“更新”安装仓库版本，“重置”恢复 App 内置版本。1.3.0 起提供 `show_page` 工具，安装它需要支持基础卡片新增工具名的 App 版本。1.3.1 的描述列表直接显示系统分组列表，不再套外层卡片。

插件首页有两个入口：**系统组件**展示 35 个原有组件示例，并补充 GitHub 个人主页使用的 `calendarHeatmap` 提交热力图示例（使用演示数据）；**通用卡片**展示由四种固定 UI 卡片组成的 Page。四种卡片在 `scripts/card-catalog.js` 中定义并校验：

| 类型 | 所需数据 | 页面中的固定 UI |
| --- | --- | --- |
| `metric` | `name`、`value`；可选 `subtitle`、`icon`、`trend` | 名称、大号数值和说明 |
| `summary` | `name`、`body` | 标题和摘要正文 |
| `detailList` | `name`、关联的 `rows` | 标题和键值明细，直接显示系统分组列表 |
| `chart` | `name`、`chartKind`、关联的 `points` | 折线、柱状或环形图 |

Agent 通过 `show_page` 一次传入 Page 标题和按顺序排列的 1 至 4 张卡片。每张卡片的 `cardKey` 在本次调用内唯一；明细行和数据点用 `cardKey` 关联。插件先校验数据，再在对话里显示一个页面入口；点击入口打开由多张卡片组成的半弹层。Agent 只选择卡片类型和填写数据，不提供 UI 节点或脚本。

```json
{
  "title": "客厅状态",
  "cards": [
    {"cardKey":"state","type":"metric","name":"空调","value":"关","subtitle":"在线"},
    {"cardKey":"summary","type":"summary","name":"结论","body":"灯光和空调均未运行。"},
    {"cardKey":"devices","type":"detailList","name":"设备明细"}
  ],
  "rows": [{"cardKey":"devices","name":"客厅主灯","value":"关"}]
}
```

`show_metrics` 仍展示每行两张的指标卡。它可以额外接收 `detailCards`、`detailRows`、`detailPoints`：每张详情卡用从 0 开始的 `metricIndex` 关联某项指标。点击指标后，同样用通用卡片目录组装详情 Page；没有传详情卡时展示原有指标信息。网页列表和三种图表工具保持原用法。

页面数据随对话卡片的点击参数保存；点击时只把当前 Page 暂存到插件自己的一个固定键，弹层读取后立即删除，不累计历史页面文件。插件安装、卸载和 Agent 归属仍由 App 管理。
