# Docker 容器

插件通过 `host.call("shell.execute", …)` 在用户为当前 Agent 选定的默认运行环境中执行只读 Docker 命令，不需要单独保存 SSH 凭据，也不让模型填写环境 ID。需要 App 支持插件调用 `ish_shell` 能力，并在 Agent 中同时启用「运行环境」和「界面展示」。所选环境需安装 Docker CLI，且当前用户能访问 Docker daemon。

`list_containers` 使用 `docker ps --all --format '{{json .}}'` 找到容器；`show_container` 用 `docker inspect` 读取名称、镜像、状态、端口和挂载数量。运行中的容器再用 `docker stats --no-stream` 读取 CPU、内存和累计网络 I/O。统计失败时仍展示基础信息，并在工具结果中返回原因。卡片是查询快照。

卡片参考容器管理面板的深色布局，包含镜像、两个使用率圆环、网络累计接收与发送，以及状态、端口和卷徽标。网络数值是 **累计字节量**，不是实时速率。`docker stats` 对已停止容器不提供运行指标，因此停止状态只显示基础信息。卡片没有暂停、停止、重启或删除按钮；这些操作需要单独的用户授权和受控命令流程。

## 安装

在插件商店安装「Docker 容器」，或从 `https://github.com/cuebo/plugins/tree/main/docker` 导入。将插件添加到 Agent，并为 Agent 选择安装了 Docker 的运行环境。之后可询问“列出 Docker 容器”或“看看 prowlarr 容器状态”。

本地脚本验证：`node docker/main.test.js`。
