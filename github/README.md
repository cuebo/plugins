# GitHub 插件

在 Agent 中配置 GitHub 访问令牌后，询问“看下我的 GitHub 主页”会调用 `profile_card`，在对话中显示个人概览。已有仓库、Issue 和 Pull Request 工具继续可用。

询问“看下 owner/repo 仓库”会调用 `repo_card`，在对话中显示仓库概览。卡片用现有的深色容器、文字、图标、网格、标签和提交热力图组合，不需要新的 App 组件。顶部显示仓库名、Stars 和简介，中部显示主语言、许可证、分支数、标签数与代码更新时间，底部显示近一年提交热力图。Forks、开放 Issue、开放 Pull Request、Watchers 和贡献者仍由工具结果返回。

近一年热力图来自 GitHub 的每日提交统计接口；该接口暂时返回 `202` 时显示“正在生成统计”，不可用时不补造数据。原有最近六周活动仍由工具结果返回。技术栈仍从仓库主语言和根目录 `package.json` 的依赖推断并由工具结果返回。最近更新使用代码推送时间。

个人概览卡片用 Cuebo 基础组件组合成适合手机宽度的深色页面：头像旁依次显示“姓名 | @ID”、简介和 GitHub 链接，地点置于头像区域下方；六项统计放在三列网格中；语言标签排成一行，下面是绿色贡献热力图。底部不再显示统计口径说明。简介、地点和链接仅在 GitHub 返回数据时展示。图片参考中的装饰性 GitHub 水印与自由背景光效不属于现有插件 UI 协议，因此卡片使用 App 已支持的深色渐变容器。完整展示需要支持 `calendarHeatmap`、圆形图片尺寸及描边的 App 版本；旧版 App 会显示不含热力图的简化卡片，并提示更新。

数据来自 GitHub GraphQL API。仓库数和 Stars 仅统计当前账号拥有的公开仓库；Stars 与主要语言最多遍历前 1000 个仓库，超过时显示部分统计。主要语言按仓库的主语言出现次数排序。贡献日历、今年贡献数和连续贡献天数由 GitHub 返回的每日贡献数计算；私有贡献是否计入取决于 GitHub 令牌权限。卡片是查询时的快照。

本地模拟检查：

```sh
node github/profile_card.test.js
node github/repo_card.test.js
python3 scripts/generate-index.py --check
```
