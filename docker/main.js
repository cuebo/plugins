function dockerShellQuote(value) {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function dockerRun(command) {
  // The App routes an omitted environment_id to the Agent's user-selected default.
  var response = JSON.parse(host.call("shell.execute", JSON.stringify({command: command})));
  if (response.truncated) throw new Error("Docker 命令输出已截断，请缩小查询范围");
  if (response.exitCode !== 0) {
    throw new Error((response.output || "Docker 命令失败").trim().slice(0, 500));
  }
  return String(response.output || "").trim();
}

function dockerText(value, label, limit) {
  if (typeof value !== "string" || !value.trim() || value.length > limit) {
    throw new Error(label + "无效");
  }
  return value.trim();
}

function dockerNumber(value, label, max) {
  if (typeof value !== "number" || !isFinite(value) || value < 0 || value > max || Math.floor(value) !== value) {
    throw new Error(label + "无效");
  }
  return value;
}

function dockerPercent(value) {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?%$/.test(value.trim())) return null;
  var number = Number(value.slice(0, -1));
  return isFinite(number) && number >= 0 && number <= 100000 ? number : null;
}

function dockerNetIO(value) {
  if (typeof value !== "string") return null;
  var parts = value.split(/\s+\/\s+/);
  if (parts.length !== 2 || parts.some(function(part) { return !/^\d+(?:\.\d+)?\s*[A-Za-z]+$/.test(part) || part.length > 24; })) return null;
  return {rx: parts[0], tx: parts[1]};
}

function dockerState(state) {
  var labels = {running:"运行中",paused:"已暂停",restarting:"重启中",exited:"已停止",created:"已创建",dead:"异常",removing:"删除中"};
  var colors = {running:"PLUGIN_ACCENT_BLUE",paused:"PLUGIN_ACCENT_YELLOW",restarting:"PLUGIN_ACCENT_ORANGE",exited:"PLUGIN_ACCENT_GRAY",created:"PLUGIN_ACCENT_GRAY",dead:"PLUGIN_ACCENT_RED",removing:"PLUGIN_ACCENT_ORANGE"};
  return {label: labels[state] || state, color: colors[state] || "PLUGIN_ACCENT_GRAY"};
}

function dockerBadge(id, label, color) {
  return {id:id,badge:{text:label,appearance:{accent:color}}};
}

function dockerMetric(id, value, title, color) {
  return {id:id,stack:{spacing:5,children:[
    {id:id+"Value",text:{text:value,style:"PLUGIN_TEXT_STYLE_VALUE",alignment:"PLUGIN_ALIGNMENT_CENTER",appearance:{accent:color}}},
    {id:id+"Title",text:{text:title,style:"PLUGIN_TEXT_STYLE_CAPTION",alignment:"PLUGIN_ALIGNMENT_CENTER"}}
  ]}};
}

registerTool("list_containers", function() {
  var output = dockerRun("docker ps --all --format '{{json .}}'");
  var lines = output ? output.split("\n") : [];
  var containers = [];
  for (var index = 0; index < lines.length && index < 50; index++) {
    var item = JSON.parse(lines[index]);
    containers.push({id:dockerText(item.ID,"容器 ID",128),name:dockerText(item.Names,"容器名称",256),
      image:dockerText(item.Image,"镜像",512),status:dockerText(item.Status,"状态",256)});
  }
  return JSON.stringify({containers:containers,limited:lines.length > 50});
});

registerTool("show_container", function(raw) {
  var input = JSON.parse(raw || "{}");
  var reference = dockerText(input.container,"容器名称或 ID",128);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(reference)) throw new Error("容器名称或 ID 无效");
  var template = '{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Config.Image}},"state":{{json .State.Status}},"port_count":{{len .NetworkSettings.Ports}},"volume_count":{{len .Mounts}}}';
  var inspected = JSON.parse(dockerRun("docker inspect --type container --format " + dockerShellQuote(template) + " " + dockerShellQuote(reference)));
  var id = dockerText(inspected.id,"容器 ID",128);
  var name = dockerText(inspected.name,"容器名称",256).replace(/^\//, "");
  var image = dockerText(inspected.image,"镜像",512);
  var state = dockerText(inspected.state,"状态",32);
  var portCount = dockerNumber(inspected.port_count,"端口数量",10000);
  var volumeCount = dockerNumber(inspected.volume_count,"卷数量",10000);
  var cpu = null, memory = null, net = null, statsError = null;
  if (state === "running") {
    try {
      var stats = JSON.parse(dockerRun("docker stats --no-stream --format '{{json .}}' " + dockerShellQuote(id)));
      if (typeof stats.ID !== "string" || id.indexOf(stats.ID) !== 0) throw new Error("容器统计结果不匹配");
      cpu = dockerPercent(stats.CPUPerc);
      memory = dockerPercent(stats.MemPerc);
      net = dockerNetIO(stats.NetIO);
    } catch (error) { statsError = String(error.message || error).slice(0, 300); }
  }

  var status = dockerState(state);
  var children = [{id:"dockerHeader",stack:{axis:"PLUGIN_LAYOUT_AXIS_HORIZONTAL",spacing:12,children:[
    {id:"dockerIcon",icon:{appearance:{accent:"PLUGIN_ACCENT_PURPLE",iconSource:{systemName:"shippingbox.fill"}}}},
    {id:"dockerIdentity",stack:{spacing:3,children:[
      {id:"dockerName",text:{text:name,style:"PLUGIN_TEXT_STYLE_TITLE"}},
      {id:"dockerImage",text:{text:image,style:"PLUGIN_TEXT_STYLE_CAPTION"}}
    ]}}
  ]}}];
  var metrics = [];
  if (cpu !== null) metrics.push({id:"dockerCPU",circularProgress:{title:"CPU",progress:Math.min(cpu/100,1),diameter:52,layout:"PLUGIN_LAYOUT_VERTICAL",value:{text:String(Math.round(cpu*10)/10)+"%"},appearance:{accent:"PLUGIN_ACCENT_BLUE"}}});
  if (memory !== null) metrics.push({id:"dockerMemory",circularProgress:{title:"内存",progress:Math.min(memory/100,1),diameter:52,layout:"PLUGIN_LAYOUT_VERTICAL",value:{text:String(Math.round(memory*10)/10)+"%"},appearance:{accent:"PLUGIN_ACCENT_GREEN"}}});
  if (net) {
    metrics.push(dockerMetric("dockerRx",net.rx,"↓ 累计接收","PLUGIN_ACCENT_BLUE"));
    metrics.push(dockerMetric("dockerTx",net.tx,"↑ 累计发送","PLUGIN_ACCENT_GREEN"));
  }
  if (metrics.length) children.push({id:"dockerMetrics",grid:{columns:Math.min(metrics.length,4),spacing:4,children:metrics}});
  children.push({id:"dockerBadges",stack:{axis:"PLUGIN_LAYOUT_AXIS_HORIZONTAL",spacing:4,children:[
    dockerBadge("dockerStatus","● " + status.label,status.color),
    dockerBadge("dockerPorts",portCount + " 端口","PLUGIN_ACCENT_BLUE"),
    dockerBadge("dockerVolumes",volumeCount + " 卷","PLUGIN_ACCENT_ORANGE")
  ]}});
  var card = {id:"docker" + Date.now().toString(36) + Math.floor(Math.random()*1000000).toString(36),
    title:"Docker 容器",components:[{id:"dockerCard",card:{appearance:{accent:"PLUGIN_ACCENT_GRAY",variant:"PLUGIN_COMPONENT_VARIANT_DARK"},children:children}}]};
  var shown = JSON.parse(host.ui("show", JSON.stringify(card)));
  return JSON.stringify({shown:shown.ok === true,id:id,name:name,image:image,state:state,
    cpu_percent:cpu,memory_percent:memory,network_io:net,port_count:portCount,volume_count:volumeCount,stats_error:statsError});
});
