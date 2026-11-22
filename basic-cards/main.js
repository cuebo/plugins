function requiredText(value, name, limit) {
  if (typeof value !== "string" || !value.trim() || value.length > limit) throw new Error(name + "无效");
  return value.trim();
}

function basicCardEnglish() {
  return typeof host.language === "function" && /^en(?:-|$)/i.test(host.language());
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

// The sheet reads the original fields. Preview truncation never discards details.
function renderDetail(card, cardId, accent) {
  var id = cardId + "-detail";
  var appearance = {accent:accent};
  function label(suffix, value, size, weight, muted) {
    var content = {text:value,fontSize:size,weight:weight};
    if (muted) content.style = "PLUGIN_TEXT_STYLE_SUBTITLE";
    return {id:id+"-"+suffix,text:content};
  }
  function icon(suffix, symbol, tile) {
    return {id:id+"-"+suffix,icon:{appearance:{accent:accent,iconSource:{systemName:symbol},size:"PLUGIN_COMPONENT_SIZE_COMPACT",variant:tile?"PLUGIN_COMPONENT_VARIANT_TILE":""}}};
  }
  function line(suffix, item) {
    var children = [];
    if (item.icon) children.push(icon(suffix+"-icon",item.icon,false));
    children.push(label(suffix+"-text",item.text,14,"PLUGIN_FONT_WEIGHT_REGULAR",true));
    return {id:id+"-"+suffix,stack:{axis:"PLUGIN_STACK_AXIS_HORIZONTAL",spacing:8,children:children}};
  }
  var body = [];
  if (card.subtitle) body.push(label("subtitle",card.subtitle,13,"PLUGIN_FONT_WEIGHT_REGULAR",true));
  if (card.headline) body.push(label("headline",card.headline,22,"PLUGIN_FONT_WEIGHT_BOLD",false));
  if (card.detail) body.push(label("description",card.detail,14,"PLUGIN_FONT_WEIGHT_REGULAR",true));
  (card.facts || []).forEach(function(item,i) { body.push(line("fact-"+i,item)); });
  if (card.resource) {
    var copy = [label("resource-title",card.resource.title,15,"PLUGIN_FONT_WEIGHT_SEMIBOLD",false)];
    if (card.resource.subtitle) copy.push(label("resource-subtitle",card.resource.subtitle,13,"PLUGIN_FONT_WEIGHT_REGULAR",true));
    var children = [];
    if (card.resource.icon) children.push(icon("resource-icon",card.resource.icon,true));
    children.push({id:id+"-resource-copy",stack:{spacing:4,children:copy}});
    var resource = {children:[{id:id+"-resource-row",stack:{axis:"PLUGIN_STACK_AXIS_HORIZONTAL",spacing:10,children:children}}],appearance:{accent:accent,variant:"PLUGIN_COMPONENT_VARIANT_SUBTLE"},padding:12};
    if (card.resource.url) resource.onTap = {openURL:card.resource.url};
    body.push({id:id+"-resource",card:resource});
  }
  if (card.points && card.points.length >= 2) {
    body.push({id:id+"-chart",chart:{kind:"PLUGIN_CHART_KIND_AREA",height:150,points:card.points,appearance:appearance,options:{hideAxes:true}}});
  }
  if (card.steps && card.steps.length >= 2) {
    var current = Math.max(0,Math.min(card.steps.length-1,card.currentStep || 0));
    body.push({id:id+"-progress",progress:{progress:current/(card.steps.length-1),appearance:appearance}});
    card.steps.forEach(function(step,i) {
      body.push(line("step-"+i,{text:step.title,icon:i<=current?"checkmark.circle.fill":"circle"}));
    });
  }
  if (card.footer && card.footer.length) {
    body.push({id:id+"-footer-divider",divider:{}});
    card.footer.forEach(function(item,i) { body.push(line("footer-"+i,item)); });
  }
  if (card.actions && card.actions.length) {
    body.push({id:id+"-actions-divider",divider:{}});
    body.push({id:id+"-actions",stack:{axis:"PLUGIN_STACK_AXIS_HORIZONTAL",spacing:8,children:card.actions.map(function(action,i) {
      return {id:id+"-action-"+i,button:{title:action.title,appearance:{accent:accent,size:"PLUGIN_COMPONENT_SIZE_SMALL",iconSource:{systemName:action.icon || "arrow.up.right"}},onTap:{openURL:action.url}}};
    })}});
  }
  return body;
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
  var bottom = [];
  var hasResource = !!card.resource;
  var hasChart = !!(card.points && card.points.length >= 2);
  var hasSteps = !!(card.steps && card.steps.length >= 2);
  var primary = hasResource ? "resource" : hasChart ? "chart" : hasSteps ? "steps" : "facts";
  if (card.headline) body.push(label("headline",card.headline,18,"PLUGIN_FONT_WEIGHT_BOLD",false,18));
  if (card.detail) {
    if (primary === "facts" && (!(card.facts || []).length || !(card.footer || []).length)) {
      body.push(label("detail",card.detail,10,"PLUGIN_FONT_WEIGHT_REGULAR",true,30));
    } else if (summary) summary.shortened = true;
  }
  if (card.facts && card.facts.length > (primary === "facts" ? 2 : 0) && summary) summary.shortened = true;
  if (primary === "facts") (card.facts || []).slice(0,2).forEach(function(item,i) { body.push(line("fact-"+i,item,24)); });
  if (primary === "resource") {
    var resourceCopy = [label("resource-title",card.resource.title,11,"PLUGIN_FONT_WEIGHT_SEMIBOLD",false,22)];
    if (card.resource.subtitle) resourceCopy.push(label("resource-subtitle",card.resource.subtitle,10,"PLUGIN_FONT_WEIGHT_REGULAR",true,20));
    var resourceChildren = [];
    if (card.resource.icon) resourceChildren.push(icon("resource-icon",card.resource.icon,true));
    resourceChildren.push({id:id+"-resource-copy",stack:{spacing:2,children:resourceCopy}});
    var resource = {children:[{id:id+"-resource-row",stack:{axis:"PLUGIN_STACK_AXIS_HORIZONTAL",spacing:6,children:resourceChildren}}],appearance:{accent:accent,variant:"PLUGIN_COMPONENT_VARIANT_SUBTLE"},padding:7};
    body.push({id:id+"-resource",card:resource});
  }
  if (hasChart && primary !== "chart" && summary) summary.shortened = true;
  if (primary === "chart") {
    body.push({id:id+"-chart",chart:{kind:"PLUGIN_CHART_KIND_AREA",height:56,points:card.points,appearance:appearance,options:{hideAxes:true}}});
  }
  if (hasSteps && primary !== "steps" && summary) summary.shortened = true;
  if (primary === "steps") {
    var current = Math.max(0,Math.min(card.steps.length-1,card.currentStep || 0));
    body.push({id:id+"-progress",progress:{progress:current/(card.steps.length-1),appearance:appearance}});
    body.push({id:id+"-steps",stack:{axis:"PLUGIN_STACK_AXIS_HORIZONTAL",spacing:3,children:card.steps.map(function(step,i) {
      return label("step-"+i,step.title,10,"PLUGIN_FONT_WEIGHT_REGULAR",i>current,12);
    })}});
  }
  if (card.actions && card.actions.length && summary) summary.shortened = true;
  if (card.footer && card.footer.length) {
    if (card.footer.length > 2 && summary) summary.shortened = true;
    var visibleFooter = card.footer.slice(0,2);
    var footerLength = visibleFooter.reduce(function(total,item) { return total + item.text.length; },0);
    var footerAxis = visibleFooter.length <= 2 && footerLength <= 11 ? "PLUGIN_STACK_AXIS_HORIZONTAL" : "PLUGIN_STACK_AXIS_VERTICAL";
    bottom.push({id:id+"-footer",card:{children:[{id:id+"-footer-row",stack:{axis:footerAxis,spacing:5,children:visibleFooter.map(function(item,i) { return line("footer-"+i,item,24); })}}],appearance:{variant:"PLUGIN_COMPONENT_VARIANT_SUBTLE"},padding:6,
      expandOnTap:true,detailTitle:card.title,detailChildren:renderDetail(card,id+"-footer",accent)}});
  }
  return {id:id,card:{children:body,bottomChildren:bottom,detailTitle:card.title,detailChildren:renderDetail(card,id,accent),expandOnTap:true,
    appearance:{variant:"PLUGIN_COMPONENT_VARIANT_SURFACE",accent:accent},aspectRatio:1,padding:8,spacing:4}};
}

// Information cards use the full chat width and let the quoted text wrap to
// its natural height. The host already renders these reusable Cuebo nodes.
function renderInformationCard(card, index) {
  var id = "basic-information-" + index;
  var accent = "PLUGIN_ACCENT_" + card.accent.toUpperCase();
  var children = [
    {id:id+"-title",text:{text:card.title,fontSize:17,weight:"PLUGIN_FONT_WEIGHT_SEMIBOLD"}}
  ];
  children.push({id:id+"-subtitle",text:{text:card.subtitle,fontSize:13,style:"PLUGIN_TEXT_STYLE_SUBTITLE"}});
  // A single system Divider is a hairline. Four adjacent dividers form a
  // clearer blockquote rule and keep the line as tall as the wrapped text.
  var rule = [0,1,2,3].map(function(i) { return {id:id+"-quote-rule-"+i,divider:{}}; });
  children.push({id:id+"-quote",stack:{axis:"PLUGIN_STACK_AXIS_HORIZONTAL",spacing:10,children:[
    {id:id+"-quote-rule",stack:{axis:"PLUGIN_STACK_AXIS_HORIZONTAL",spacing:0,children:rule}},
    {id:id+"-content",text:{text:card.content,fontSize:12,weight:"PLUGIN_FONT_WEIGHT_REGULAR",style:"PLUGIN_TEXT_STYLE_SUBTITLE",alignment:"PLUGIN_TEXT_ALIGNMENT_LEADING"}}
    ]}});
  return {id:id,card:{children:children,appearance:{variant:"PLUGIN_COMPONENT_VARIANT_SURFACE",accent:accent},padding:14,spacing:8}};
}

function showCards(raw) {
  var input = JSON.parse(raw || "{}");
  if (!Array.isArray(input.cards) || input.cards.length < 1 || input.cards.length > 6) throw new Error("卡片数量需为 1 至 6");
  var shortenedCards = [];
  var components = [], compactCards = [];
  function flushCompactCards() {
    if (!compactCards.length) return;
    components.push({id:"basic-card-grid-"+components.length,grid:{columns:2,spacing:10,children:compactCards}});
    compactCards = [];
  }
  input.cards.forEach(function(item, index) {
    if (!item || typeof item !== "object") throw new Error("卡片无效");
    if (item.type === "information") {
      var info = {title:requiredText(item.title,"卡片标题",60),
        subtitle:requiredText(item.subtitle,"卡片副标题",120),
        content:requiredText(item.content,"引用内容",1200),
        accent:optionalText(item.accent,"强调色",10) || "blue"};
      if (["blue","green","orange","purple","teal","red"].indexOf(info.accent) < 0) throw new Error("强调色无效");
      flushCompactCards();
      components.push(renderInformationCard(info,index));
      return;
    }
    if (item.type != null && item.type !== "compact") throw new Error("卡片类型无效");
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
    compactCards.push(rendered);
  });
  flushCompactCards();
  var id = "basic" + Date.now().toString(36) + Math.floor(Math.random() * 1000000000).toString(36);
  var response = JSON.parse(host.ui("show", JSON.stringify({id:id,title:basicCardEnglish()?"Information Cards":"信息卡片",components:components})));
  return JSON.stringify({shown:response.ok === true,count:input.cards.length,shortenedCards:shortenedCards});
}

registerTool("show_cards", showCards);

// These are data examples, not new component types. The plugin homepage renders
// them through the same reusable card composition used for conversation cards.
function basicCardExamples() {
  if (basicCardEnglish()) return [
    {title:"Schedule",subtitle:"Thu · 10:00–11:00",icon:"calendar",accent:"purple",
      headline:"Product review",facts:[{icon:"mappin",text:"Building A · Room 301"}],footer:[{icon:"person.2",text:"8 attendees"}]},
    {title:"File details",subtitle:"Document · 12.4 MB",icon:"folder",accent:"blue",
      resource:{title:"Product requirements.pdf",subtitle:"Updated 09:42",icon:"doc.text.fill"}},
    {title:"Weekly data",subtitle:"+12.6% vs last week",icon:"chart.bar",accent:"green",
      headline:"26,480",points:[{label:"Mon",value:12},{label:"Tue",value:18},{label:"Wed",value:16},{label:"Thu",value:24},{label:"Fri",value:21},{label:"Sat",value:27},{label:"Sun",value:30}]},
    {title:"Order progress",subtitle:"Order · DP784392",icon:"shippingbox",accent:"orange",
      headline:"In transit",detail:"Due Friday",steps:[{title:"Shipped"},{title:"In transit"},{title:"Out for delivery"}],currentStep:1},
    {title:"Weather",subtitle:"Beijing",icon:"cloud.sun",accent:"blue",
      headline:"12°C",detail:"Cloudy · feels like 10°C",footer:[{icon:"wind",text:"NE wind · level 3"},{icon:"humidity",text:"Humidity 45%"}]},
    {title:"Device status",subtitle:"Living room · online",icon:"hifispeaker",accent:"purple",
      headline:"Running",detail:"Up for 3 h 24 min",footer:[{icon:"thermometer",text:"24.0°C"},{icon:"fanblades",text:"Auto"}]}
  ];
  return [
    {title:"日程安排",subtitle:"周四 · 10:00–11:00",icon:"calendar",accent:"purple",
      headline:"产品评审会",facts:[{icon:"mappin",text:"A 栋 3F · 会议室 301"}],footer:[{icon:"person.2",text:"8 位参与者"}]},
    {title:"文件详情",subtitle:"文档 · 12.4 MB",icon:"folder",accent:"blue",
      resource:{title:"产品需求文档.pdf",subtitle:"更新于 09:42",icon:"doc.text.fill"}},
    {title:"本周数据",subtitle:"较上周 +12.6%",icon:"chart.bar",accent:"green",
      headline:"26,480",points:[{label:"周一",value:12},{label:"周二",value:18},{label:"周三",value:16},{label:"周四",value:24},{label:"周五",value:21},{label:"周六",value:27},{label:"周日",value:30}]},
    {title:"订单进度",subtitle:"编号 · DP784392",icon:"shippingbox",accent:"orange",
      headline:"运输中",detail:"预计周五送达",steps:[{title:"已发货"},{title:"运输中"},{title:"派送中"}],currentStep:1},
    {title:"环境概览",subtitle:"北京市",icon:"cloud.sun",accent:"blue",
      headline:"12°C",detail:"多云 · 体感 10°C",footer:[{icon:"wind",text:"东北风3级"},{icon:"humidity",text:"湿度45%"}]},
    {title:"设备状态",subtitle:"客厅 · 在线",icon:"hifispeaker",accent:"purple",
      headline:"运行中",detail:"已运行 3 小时 24 分钟",footer:[{icon:"thermometer",text:"24.0°C"},{icon:"fanblades",text:"自动"}]}
  ];
}

function basicCardExamplesGrid(gridId, prefix) {
  return {id:gridId,grid:{columns:2,spacing:10,children:basicCardExamples().map(function(card,index) {
    return renderCard(card,prefix ? prefix+"-"+index : index);
  })}};
}

function dashboard(ctx) {
  var english = basicCardEnglish();
  return {
    title:english?"Basic Cards":"基础卡片",
    components:[
      {id:"demo-label",text:{text:english?"Tap a card for details · Sample data for preview only":"点击卡片查看完整信息 · 示例数据仅用于预览",style:"PLUGIN_TEXT_STYLE_CAPTION"}},
      basicCardExamplesGrid("demo-grid",""),
      renderInformationCard(english?
        {title:"Information",subtitle:"Example · verified content",content:"A concise conclusion or excerpt can be displayed here. Longer text wraps within the quoted area.",accent:"blue"}:
        {title:"信息展示",subtitle:"示例 · 已核实内容",content:"这里可以展示一段结论或原文摘录。内容较长时会在引用区内自动换行。",accent:"blue"},"demo"),
      {id:"catalog-link",button:{title:english?"View component catalog":"查看组件目录",appearance:{accent:"PLUGIN_ACCENT_BLUE"},
        onTap:{navigate:{surface:"detail",route:"catalog"}}}}
    ]
  };
}
