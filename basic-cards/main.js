function requiredText(value, name, limit) {
  if (typeof value !== "string" || !value.trim() || value.length > limit) throw new Error(name + "无效");
  return value.trim();
}

function optionalText(value, name, limit) {
  if (value == null || value === "") return "";
  return requiredText(value, name, limit);
}

function optionalSymbol(value) {
  var symbol = optionalText(value, "图标", 80);
  if (symbol && !/^[a-z0-9][a-z0-9.-]*$/.test(symbol)) throw new Error("图标名称无效");
  return symbol;
}

function optionalURL(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || !/^https?:\/\/[^\s]+$/i.test(value) || value.length > 2048) throw new Error("链接无效");
  return value;
}

function optionalItems(value, max) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > max) throw new Error("条目数量无效");
  return value;
}

function note(item, name) {
  if (!item || typeof item !== "object") throw new Error(name + "无效");
  return {text:requiredText(item.text, name, 100), icon:optionalSymbol(item.icon)};
}

function showCards(raw) {
  var input = JSON.parse(raw || "{}");
  if (!Array.isArray(input.cards) || input.cards.length < 1 || input.cards.length > 6) throw new Error("卡片数量需为 1 至 6");
  var components = input.cards.map(function(item, index) {
    if (!item || typeof item !== "object") throw new Error("卡片无效");
    var card = {
      title:requiredText(item.title, "卡片标题", 60),
      subtitle:optionalText(item.subtitle, "卡片副标题", 120),
      icon:optionalSymbol(item.icon),
      accent:optionalText(item.accent, "强调色", 10) || "blue",
      headline:optionalText(item.headline, "主要内容", 100),
      detail:optionalText(item.detail, "补充内容", 160),
      facts:optionalItems(item.facts, 4).map(function(fact) { return note(fact, "事实"); }),
      footer:optionalItems(item.footer, 3).map(function(fact) { return note(fact, "底部信息"); }),
      actions:optionalItems(item.actions, 2).map(function(action) {
        if (!action || typeof action !== "object") throw new Error("操作无效");
        return {title:requiredText(action.title, "操作名称", 30),icon:optionalSymbol(action.icon),
          url:requiredText(optionalURL(action.url), "操作链接", 2048)};
      })
    };
    if (["blue", "green", "orange", "purple", "teal", "red"].indexOf(card.accent) < 0) throw new Error("强调色无效");
    if (item.resource != null) {
      var resource = item.resource;
      if (!resource || typeof resource !== "object") throw new Error("资源无效");
      card.resource = {title:requiredText(resource.title, "资源标题", 100),
        subtitle:optionalText(resource.subtitle, "资源说明", 120),
        icon:optionalSymbol(resource.icon),url:optionalURL(resource.url)};
    }
    var points = optionalItems(item.points, 24);
    if (points.length === 1) throw new Error("趋势图至少需要 2 个数据点");
    if (points.length) card.points = points.map(function(point) {
      if (!point || typeof point !== "object" || typeof point.value !== "number" || !isFinite(point.value) || Math.abs(point.value) > 1e12) throw new Error("趋势数据无效");
      return {label:requiredText(point.label, "数据标签", 50), value:point.value};
    });
    var steps = optionalItems(item.steps, 6);
    if (steps.length) {
      if (steps.length < 2 || typeof item.current_step !== "number" || !Number.isInteger(item.current_step) || item.current_step < 0 || item.current_step >= steps.length) throw new Error("进度步骤无效");
      card.steps = steps.map(function(step) { return {title:requiredText(step.title, "步骤名称", 30)}; });
      card.currentStep = item.current_step;
    }
    if (!card.headline && !card.detail && !card.facts.length && !card.resource && !card.points && !card.steps && !card.footer.length) throw new Error("卡片内容不能为空");
    return {id:"showcase-" + index,showcaseCard:card};
  });
  var id = "basic" + Date.now().toString(36) + Math.floor(Math.random() * 1000000000).toString(36);
  var response = JSON.parse(host.ui("show", JSON.stringify({id:id,title:"信息卡片",components:components})));
  return JSON.stringify({shown:response.ok === true,count:components.length});
}

registerTool("show_cards", showCards);

function dashboard(ctx) {
  return {
    title:"基础卡片",
    components:[
      {id:"demo-label",text:{text:"以下为样式示例，数据仅用于预览",style:"PLUGIN_TEXT_STYLE_CAPTION"}},
      {id:"demo-event",showcaseCard:{title:"日程安排",subtitle:"周四 · 10:00–11:00",icon:"calendar",accent:"purple",
        headline:"产品评审会",facts:[{icon:"mappin",text:"A 栋 3F · 会议室 301"}],footer:[{icon:"person.2",text:"8 位参与者"}]}},
      {id:"demo-resource",showcaseCard:{title:"文件详情",subtitle:"文档 · 12.4 MB",icon:"folder",accent:"blue",
        resource:{title:"产品需求文档.pdf",subtitle:"更新于 09:42",icon:"doc.text.fill"}}},
      {id:"demo-trend",showcaseCard:{title:"本周数据",subtitle:"较上周 +12.6%",icon:"chart.bar",accent:"green",
        headline:"26,480",points:[{label:"周一",value:12},{label:"周二",value:18},{label:"周三",value:16},{label:"周四",value:24},{label:"周五",value:21},{label:"周六",value:27},{label:"周日",value:30}]}},
      {id:"demo-progress",showcaseCard:{title:"订单进度",subtitle:"编号 · DP784392",icon:"shippingbox",accent:"orange",
        headline:"运输中",detail:"预计周五送达",steps:[{title:"已发货"},{title:"运输中"},{title:"派送中"}],currentStep:1}},
      {id:"demo-conditions",showcaseCard:{title:"环境概览",subtitle:"北京市",icon:"cloud.sun",accent:"blue",
        headline:"12°C",detail:"多云 · 体感 10°C",footer:[{icon:"wind",text:"东北风 3 级"},{icon:"humidity",text:"湿度 45%"}]}},
      {id:"demo-status",showcaseCard:{title:"设备状态",subtitle:"客厅 · 在线",icon:"hifispeaker",accent:"purple",
        headline:"运行中",detail:"已运行 3 小时 24 分钟",footer:[{icon:"thermometer",text:"24.0°C"},{icon:"fanblades",text:"自动"}]}},
      {id:"catalog-link",button:{title:"查看组件目录",appearance:{accent:"PLUGIN_ACCENT_BLUE"},
        onTap:{navigate:{surface:"detail",route:"catalog"}}}}
    ]
  };
}
