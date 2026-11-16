# GitHub 插件

在 Agent 中配置 GitHub 访问令牌后，询问“看下我的 GitHub 主页”会调用 `profile_card`，在对话中显示个人概览。已有仓库、Issue 和 Pull Request 工具继续可用。

卡片仅组合 Cuebo 基础组件：深色容器、文字、图标、网格、图片、面积图和日期热力图。完整展示需要支持 `calendarHeatmap`、圆形图片尺寸及描边的 App 版本；旧版 App 会显示不含热力图的简化卡片，并提示更新。

数据来自 GitHub GraphQL API。仓库数和 Stars 仅统计当前账号拥有的公开仓库；Stars 与主要语言最多遍历前 1000 个仓库，超过时显示部分统计。主要语言按仓库的主语言出现次数排序。贡献日历、今年贡献数、近 30 天活动和连续贡献天数由 GitHub 返回的每日贡献数计算；私有贡献是否计入取决于 GitHub 令牌权限。卡片是查询时的快照。

本地模拟检查：

```sh
node github/profile_card.test.js
python3 scripts/generate-index.py --check
```
