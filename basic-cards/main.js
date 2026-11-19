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

// A two-column card has room for a short summary. Keep the source values in
// the tool arguments; only the visible preview is shortened.
function compactText(value, maxUnits, summary) {
  var chars = Array.from(value);
  var width = function(ch) { return ch.codePointAt(0) >= 0x2e80 ? 2 : 1; };
  var total = chars.reduce(function(sum,ch) { return sum + width(ch); }, 0);
  if (total <= maxUnits) return value;
  if (summary) summary.shortened = true;
  var result = "", used = 0;
  for (var i = 0; i < chars.length; i++) {
    var next = width(chars[i]);
    if (used + next > maxUnits - 2) break;
    result += chars[i];
    used += next;
  }
  return result.replace(/\s+$/, "") + "…";
}

// The plugin owns the card composition. The host only renders reusable Cuebo nodes.
function renderCard(card, index, summary) {
  var id = "basic-card-" + index;
  var accent = "PLUGIN_ACCENT_" + (card.accent || "blue").toUpperCase();
  var appearance = {accent:accent};
  function label(suffix, value, size, weight, muted, maxUnits) {
    var content = {text:compactText(value,maxUnits,summary),fontSize:size,weight:weight};
    if (muted) content.style = "PLUGIN_TEXT_STYLE_SUBTITLE";
    return {id:id+"-"+suffix,text:content};
  }
  function icon(suffix, symbol, tile) {
    return {id:id+"-"+suffix,icon:{appearance:{accent:accent,iconSource:{systemName:symbol},size:"PLUGIN_COMPONENT_SIZE_COMPACT",variant:tile?"PLUGIN_COMPONENT_VARIANT_TILE":""}}};
  }
  function line(suffix, item, maxUnits) {
    var children = [];
    if (item.icon) children.push(icon(suffix+"-icon",item.icon,false));
    children.push(label(suffix+"-text",item.text,10,"PLUGIN_FONT_WEIGHT_REGULAR",true,maxUnits));
    return {id:id+"-"+suffix,stack:{axis:"PLUGIN_STACK_AXIS_HORIZONTAL",spacing:5,children:children}};
  }
  var headerText = [label("title",card.title,14,"PLUGIN_FONT_WEIGHT_SEMIBOLD",false,14)];
  if (card.subtitle) headerText.push(label("subtitle",card.subtitle,10,"PLUGIN_FONT_WEIGHT_REGULAR",true,22));
  var header = [];
  if (card.icon) header.push(icon("header-icon",card.icon,true));
  header.push({id:id+"-header-copy",stack:{spacing:2,children:headerText}});
  var body = [{id:id+"-header",stack:{axis:"PLUGIN_STACK_AXIS_HORIZONTAL",spacing:8,children:header}}];
  if (card.headline) body.push(label("headline",card.headline,18,"PLUGIN_FONT_WEIGHT_BOLD",false,18));
  if (card.detail) body.push(label("detail",card.detail,10,"PLUGIN_FONT_WEIGHT_REGULAR",true,34));
  if (card.facts && card.facts.length > 2 && summary) summary.shortened = true;
  (card.facts || []).slice(0,2).forEach(function(item,i) { body.push(line("fact-"+i,item,24)); });
  if (card.resource) {
    var resourceCopy = [label("resource-title",card.resource.title,11,"PLUGIN_FONT_WEIGHT_SEMIBOLD",false,22)];
    if (card.resource.subtitle) resourceCopy.push(label("resource-subtitle",card.resource.subtitle,10,"PLUGIN_FONT_WEIGHT_REGULAR",true,20));
    var resourceChildren = [];
    if (card.resource.icon) resourceChildren.push(icon("resource-icon",card.resource.icon,true));
    resourceChildren.push({id:id+"-resource-copy",stack:{spacing:2,children:resourceCopy}});
    var resource = {children:[{id:id+"-resource-row",stack:{axis:"PLUGIN_STACK_AXIS_HORIZONTAL",spacing:6,children:resourceChildren}}],appearance:{accent:accent,variant:"PLUGIN_COMPONENT_VARIANT_SUBTLE"},padding:7};
    if (card.resource.url) resource.onTap = {openURL:card.resource.url};
    body.push({id:id+"-resource",card:resource});
  }
  if (card.points && card.points.length >= 2) {
    body.push({id:id+"-chart",chart:{kind:"PLUGIN_CHART_KIND_AREA",height:58,points:card.points,appearance:appearance,options:{hideAxes:true}}});
  }
  if (card.steps && card.steps.length >= 2) {
    var current = Math.max(0,Math.min(card.steps.length-1,card.currentStep || 0));
    body.push({id:id+"-progress",progress:{progress:current/(card.steps.length-1),appearance:appearance}});
    body.push({id:id+"-steps",stack:{axis:"PLUGIN_STACK_AXIS_HORIZONTAL",spacing:3,children:card.steps.map(function(step,i) {
      return label("step-"+i,step.title,10,"PLUGIN_FONT_WEIGHT_REGULAR",i>current,12);
    })}});
  }
  if (card.actions && card.actions.length) {
    if (!card.footer || !card.footer.length) body.push({id:id+"-actions-spacer",spacer:{length:0}});
    body.push({id:id+"-actions-divider",divider:{}});
    body.push({id:id+"-actions",stack:{axis:"PLUGIN_STACK_AXIS_HORIZONTAL",spacing:4,children:card.actions.map(function(action,i) {
      return {id:id+"-action-"+i,button:{title:compactText(action.title,12,summary),appearance:{accent:accent,size:"PLUGIN_COMPONENT_SIZE_COMPACT",variant:"PLUGIN_COMPONENT_VARIANT_PLAIN",iconSource:{systemName:action.icon || "arrow.up.right"}},onTap:{openURL:action.url}}};
    })}});
  }
  if (card.footer && card.footer.length) {
    body.push({id:id+"-footer-spacer",spacer:{length:0}});
    if (card.footer.length > 2 && summary) summary.shortened = true;
    var visibleFooter = card.footer.slice(0,2);
    var footerLength = visibleFooter.reduce(function(total,item) { return total + item.text.length; },0);
    var footerAxis = visibleFooter.length <= 2 && footerLength <= 11 ? "PLUGIN_STACK_AXIS_HORIZONTAL" : "PLUGIN_STACK_AXIS_VERTICAL";
    body.push({id:id+"-footer",card:{children:[{id:id+"-footer-row",stack:{axis:footerAxis,spacing:5,children:visibleFooter.map(function(item,i) { return line("footer-"+i,item,24); })}}],appearance:{variant:"PLUGIN_COMPONENT_VARIANT_SUBTLE"},padding:6}});
  }
  return {id:id,card:{children:body,appearance:{variant:"PLUGIN_COMPONENT_VARIANT_SURFACE",accent:accent},aspectRatio:1,padding:9,spacing:6}};
}

function showCards(raw) {
  var input = JSON.parse(raw || "{}");
  if (!Array.isArray(input.cards) || input.cards.length < 1 || input.cards.length > 6) throw new Error("卡片数量需为 1 至 6");
  var shortenedCards = [];
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
    var summary = {shortened:false};
    var rendered = renderCard(card,index,summary);
    if (summary.shortened) shortenedCards.push(index + 1);
    return rendered;
  });
  var id = "basic" + Date.now().toString(36) + Math.floor(Math.random() * 1000000000).toString(36);
  var layout = {id:"basic-card-grid",grid:{columns:2,spacing:10,children:components}};
  var response = JSON.parse(host.ui("show", JSON.stringify({id:id,title:"信息卡片",components:[layout]})));
  return JSON.stringify({shown:response.ok === true,count:components.length,shortenedCards:shortenedCards});
}

registerTool("show_cards", showCards);

function dashboard(ctx) {
  return {
    title:"基础卡片",
    components:[
      {id:"demo-label",text:{text:"以下为样式示例，数据仅用于预览",style:"PLUGIN_TEXT_STYLE_CAPTION"}},
      {id:"demo-grid",grid:{columns:2,spacing:10,children:[
      renderCard({title:"日程安排",subtitle:"周四 · 10:00–11:00",icon:"calendar",accent:"purple",
        headline:"产品评审会",facts:[{icon:"mappin",text:"A 栋 3F · 会议室 301"}],footer:[{icon:"person.2",text:"8 位参与者"}]},0),
      renderCard({title:"文件详情",subtitle:"文档 · 12.4 MB",icon:"folder",accent:"blue",
        resource:{title:"产品需求文档.pdf",subtitle:"更新于 09:42",icon:"doc.text.fill"}},1),
      renderCard({title:"本周数据",subtitle:"较上周 +12.6%",icon:"chart.bar",accent:"green",
        headline:"26,480",points:[{label:"周一",value:12},{label:"周二",value:18},{label:"周三",value:16},{label:"周四",value:24},{label:"周五",value:21},{label:"周六",value:27},{label:"周日",value:30}]},2),
      renderCard({title:"订单进度",subtitle:"编号 · DP784392",icon:"shippingbox",accent:"orange",
        headline:"运输中",detail:"预计周五送达",steps:[{title:"已发货"},{title:"运输中"},{title:"派送中"}],currentStep:1},3),
      renderCard({title:"环境概览",subtitle:"北京市",icon:"cloud.sun",accent:"blue",
        headline:"12°C",detail:"多云 · 体感 10°C",footer:[{icon:"wind",text:"东北风3级"},{icon:"humidity",text:"湿度45%"}]},4),
      renderCard({title:"设备状态",subtitle:"客厅 · 在线",icon:"hifispeaker",accent:"purple",
        headline:"运行中",detail:"已运行 3 小时 24 分钟",footer:[{icon:"thermometer",text:"24.0°C"},{icon:"fanblades",text:"自动"}]},5)
      ]}},
      {id:"catalog-link",button:{title:"查看组件目录",appearance:{accent:"PLUGIN_ACCENT_BLUE"},
        onTap:{navigate:{surface:"detail",route:"catalog"}}}}
    ]
  };
}
