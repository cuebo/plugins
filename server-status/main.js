function serverStatusText(value, label, limit) {
  if (typeof value !== "string" || !value.trim() || value.length > limit) {
    throw new Error(label + "无效");
  }
  return value.trim();
}

function serverStatusNumber(value, label, min, max) {
  if (value == null) return null;
  if (typeof value !== "number" || !isFinite(value) || value < min || value > max) {
    throw new Error(label + "无效");
  }
  return value;
}

function serverStatusRounded(value) {
  return String(Math.round(value * 10) / 10);
}

function serverStatusRate(bytesPerSecond) {
  if (bytesPerSecond >= 1024 * 1024) return serverStatusRounded(bytesPerSecond / 1048576) + " MB/s";
  if (bytesPerSecond >= 1024) return serverStatusRounded(bytesPerSecond / 1024) + " KB/s";
  return serverStatusRounded(bytesPerSecond) + " B/s";
}

function serverStatusBadge(id, text, accent) {
  return {id:id,badge:{text:text,appearance:{accent:accent}}};
}

function serverStatusMetric(id, child, accent) {
  return {id:id,card:{appearance:{accent:accent},children:[child]}};
}

registerTool("show_status", function(raw) {
  var input = JSON.parse(raw || "{}");
  var name = serverStatusText(input.name, "服务器名称", 60);
  if (typeof input.online !== "boolean") throw new Error("在线状态无效");
  var system = input.system == null ? "" : serverStatusText(input.system, "系统名称", 80);
  var sampledAt = input.sampled_at == null ? "" : serverStatusText(input.sampled_at, "采样时间", 80);
  var uptime = serverStatusNumber(input.uptime_seconds, "运行时长", 0, 10000000000);
  var cores = serverStatusNumber(input.cpu_cores, "CPU 核数", 1, 4096);
  if (cores !== null && Math.floor(cores) !== cores) throw new Error("CPU 核数无效");
  var cpu = serverStatusNumber(input.cpu_percent, "CPU 使用率", 0, 100);
  var memoryTotal = serverStatusNumber(input.memory_total_gb, "内存总量", 0, 1000000);
  var memory = serverStatusNumber(input.memory_percent, "内存使用率", 0, 100);
  var temperature = serverStatusNumber(input.temperature_c, "温度", -100, 300);
  var upload = serverStatusNumber(input.network_upload_bps, "上传速率", 0, 1000000000000);
  var download = serverStatusNumber(input.network_download_bps, "下载速率", 0, 1000000000000);
  var disk = serverStatusNumber(input.disk_percent, "磁盘使用率", 0, 100);
  var diskTotal = serverStatusNumber(input.disk_total_gb, "磁盘总量", 0, 1000000000);

  if (!input.online && [uptime, cores, cpu, memoryTotal, memory, temperature, upload, download, disk, diskTotal].some(function(v) { return v !== null; })) {
    throw new Error("离线状态不能附带本轮指标");
  }
  if (input.online && [uptime, cores, cpu, memoryTotal, memory, temperature, upload, download, disk, diskTotal].every(function(v) { return v === null; })) {
    throw new Error("没有可展示的实测指标");
  }

  var header = {id:"server-header",stack:{axis:"PLUGIN_LAYOUT_AXIS_HORIZONTAL",spacing:10,children:[
    {id:"server-icon",icon:{appearance:{accent:"PLUGIN_ACCENT_BLUE",iconSource:{systemName:"server.rack"}}}},
    {id:"server-identity",stack:{children:[
      {id:"server-name",text:{text:name,style:"PLUGIN_TEXT_STYLE_TITLE"}},
      {id:"server-system",text:{text:system || "服务器",style:"PLUGIN_TEXT_STYLE_CAPTION"}}
    ]}},
    serverStatusBadge("server-online",input.online ? "● 在线" : "● 离线",input.online ? "PLUGIN_ACCENT_GREEN" : "PLUGIN_ACCENT_RED")
  ]}};
  var children = [header];
  if (sampledAt) children.push({id:"sampled-at",text:{text:"采样 " + sampledAt,style:"PLUGIN_TEXT_STYLE_CAPTION"}});

  var facts = [];
  if (uptime !== null) {
    var days = Math.floor(uptime / 86400);
    var hours = Math.floor(uptime % 86400 / 3600);
    facts.push(serverStatusBadge("uptime", "运行 " + (days ? days + " 天" : hours + " 小时"), "PLUGIN_ACCENT_BLUE"));
  }
  if (cores !== null) facts.push(serverStatusBadge("cores", "核心 " + cores + " 核", "PLUGIN_ACCENT_BLUE"));
  if (memoryTotal !== null) facts.push(serverStatusBadge("memory-total", "内存 " + serverStatusRounded(memoryTotal) + " GiB", "PLUGIN_ACCENT_BLUE"));
  if (temperature !== null) facts.push(serverStatusBadge("temperature", "温度 " + serverStatusRounded(temperature) + "°C", "PLUGIN_ACCENT_ORANGE"));
  if (facts.length) children.push({id:"server-facts",grid:{columns:2,spacing:7,children:facts}});

  var metrics = [];
  if (cpu !== null) metrics.push(serverStatusMetric("cpu-tile",{id:"cpu-ring",circularProgress:{title:"CPU",progress:cpu / 100,value:{text:serverStatusRounded(cpu) + "%"},appearance:{accent:"PLUGIN_ACCENT_BLUE"}}},"PLUGIN_ACCENT_BLUE"));
  if (memory !== null) metrics.push(serverStatusMetric("memory-tile",{id:"memory-ring",circularProgress:{title:"内存",progress:memory / 100,value:{text:serverStatusRounded(memory) + "%"},appearance:{accent:"PLUGIN_ACCENT_GREEN"}}},"PLUGIN_ACCENT_GREEN"));
  if (upload !== null || download !== null) {
    var networkChildren = [{id:"network-title",text:{text:"网络",style:"PLUGIN_TEXT_STYLE_TITLE"}}];
    if (upload !== null) networkChildren.push({id:"network-up",text:{text:"↑ " + serverStatusRate(upload),style:"PLUGIN_TEXT_STYLE_BODY"}});
    if (download !== null) networkChildren.push({id:"network-down",text:{text:"↓ " + serverStatusRate(download),style:"PLUGIN_TEXT_STYLE_BODY"}});
    metrics.push({id:"network-tile",card:{appearance:{accent:"PLUGIN_ACCENT_TEAL"},children:networkChildren}});
  }
  if (disk !== null) metrics.push(serverStatusMetric("disk-tile",{id:"disk-progress",progress:{title:"磁盘",progress:disk / 100,value:{text:serverStatusRounded(disk) + "%" + (diskTotal !== null ? " · " + serverStatusRounded(diskTotal) + " GiB" : "")},appearance:{accent:"PLUGIN_ACCENT_GREEN"}}},"PLUGIN_ACCENT_GREEN"));
  if (metrics.length) children.push({id:"server-metrics",grid:{columns:2,spacing:9,children:metrics}});

  var card = {id:"server" + Date.now().toString(36) + Math.floor(Math.random() * 1000000).toString(36),title:"服务器状态",components:[{id:"server-card",card:{appearance:{accent:"PLUGIN_ACCENT_TEAL"},children:children}}]};
  var response = JSON.parse(host.ui("show", JSON.stringify(card)));
  return JSON.stringify({shown:response.ok === true,name:name,online:input.online,sampled_at:sampledAt || null});
});
