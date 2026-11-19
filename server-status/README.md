# 服务器管理

同一个插件提供服务器或 NAS 状态卡片，以及 Docker 容器信息卡片。插件 ID 保持 `server-status`；已安装「服务器状态」的用户在插件商店更新后，会看到「服务器管理」，无需重新添加到 Agent。

## 服务器或 NAS 状态

用户询问服务器状态时，Agent 先在已关联的运行环境执行只读查询，再调用 `plugin_server_status_show_status` 展示本轮实测结果。卡片可显示在线状态、运行时长、核心数、内存总量、温度、CPU/内存使用率、网络速率和磁盘使用率。未知指标省略；查询失败时只传 `online:false`。CPU 和网络速率需要两次采样计算，不能把系统负载或累计流量当作速率。

## Docker 容器

`plugin_server_status_list_containers` 在用户为 Agent 选定的默认环境中运行 `docker ps --all`，列出容器名称、ID、镜像和状态。`plugin_server_status_show_container` 使用 `docker inspect` 查询指定容器；运行中的容器再用 `docker stats --no-stream` 获取 CPU、内存和累计网络 I/O，并显示深色卡片、端口和卷数量。Docker 命令通过插件的 `ish_shell` 能力进入 App 的运行环境路由，不需要模型填写环境 ID，也不单独保存 SSH 凭据。

卡片是一次查询快照。`docker stats` 对已停止容器不提供运行指标；统计失败时仍展示已查到的基础信息，并把错误交给 Agent。网络 I/O 是累计接收与发送量，不是实时速率。卡片不提供暂停、停止、重启或删除按钮。

## 安装与使用

1. 在插件商店安装或更新「服务器管理」，并将它添加到 Agent。
2. 给 Agent 选择运行环境，启用「运行环境」和「界面展示」能力。查询 Docker 时，该环境需要 Docker CLI 和 daemon 访问权限。
3. 可询问“看看 NAS 状态”“列出 Docker 容器”或“看看 prowlarr 容器状态”。

Docker 卡片需要支持插件 `shell.execute` 的 App 版本（TestFlight 396 起）。插件脚本测试：`node server-status/docker.test.js`。
