function requireText(value, name, limit) {
  if (typeof value !== "string" || !value.trim() || value.length > limit) throw new Error(name + "无效");
  return value.trim();
}

function optionalURL(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || !/^https?:\/\/[^\s]+$/i.test(value) || value.length > 2048) throw new Error("图片地址无效");
  return value;
}

function requireItems(value, min, max) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error("条目数量无效");
  return value;
}

function showContent(title, components, count) {
  var id = "basic" + Date.now().toString(36) + Math.floor(Math.random() * 1000000000).toString(36);
  var response = JSON.parse(host.ui("show", JSON.stringify({
    id:id,title:title,components:components
  })));
  return JSON.stringify({shown:response.ok === true,count:count});
}

function basicPageParams(item, cards) {
  var params = {label:item.label,value:item.value,change:item.change || "",
    trend:item.trend || "",icon:item.icon || "",pageTitle:item.detailTitle || "指标详情"};
  cards.forEach(function(card, index) { params["card" + index] = JSON.stringify(card); });
  return params;
}

registerTool("show_list", function(raw) {
  var input = JSON.parse(raw);
  var items = requireItems(input.items, 1, 40).map(function(item) {
    var url = optionalURL(item.url);
    if (!url) throw new Error("条目链接无效");
    var subtitle = typeof item.subtitle === "string" ? item.subtitle.trim() : "";
    if (subtitle.length > 240) throw new Error("条目说明无效");
    return {title:requireText(item.title,"条目标题",100),
      subtitle:subtitle,url:url,
      image_url:optionalURL(item.image_url)};
  });
  return showContent("链接列表",[{id:"links",list:{items:items.map(function(item) {
    return {title:item.title,subtitle:item.subtitle,imageURL:item.image_url,
      appearance:{accent:"PLUGIN_ACCENT_BLUE",iconSource:{systemName:"arrow.up.right.square"}},
      onTap:{openURL:item.url}};
  })}}],items.length);
});

registerTool("show_metrics", function(raw) {
  var input = JSON.parse(raw);
  var items = requireItems(input.items, 1, 12).map(function(item) {
    var change = typeof item.change === "string" ? item.change : "";
    var trend = typeof item.trend === "string" ? item.trend : "";
    var icon = typeof item.icon === "string" ? item.icon.trim() : "";
    if ((change && ["up","down","flat"].indexOf(trend) < 0) || (!change && trend)) throw new Error("趋势无效");
    if (change.length > 1000) throw new Error("变化文案过长");
    if (icon && !/^[a-z0-9][a-z0-9.-]{0,79}$/.test(icon)) throw new Error("图标名称无效");
    return {label:requireText(item.label,"指标名称",50),value:requireText(item.value,"指标数值",80),
      change:change,trend:trend,icon:icon,
      detailTitle:basicOptionalText(item.detailTitle,"详情页标题",80) || item.label + "详情"};
  });
  var detailPages = basicPrepareDetailPages(input, items.length);
  return showContent("指标",[{id:"metricCards",grid:{columns:2,spacing:10,
    appearance:{container:"PLUGIN_CONTAINER_STYLE_NONE"},
    children:items.map(function(item,index) {
      var id = "metric-" + index;
      var accent = item.trend === "up" ? "PLUGIN_ACCENT_GREEN" : item.trend === "down" ? "PLUGIN_ACCENT_RED" : "PLUGIN_ACCENT_BLUE";
      var title = {id:id + "-label",text:{text:item.label,style:"PLUGIN_TEXT_STYLE_CAPTION"}};
      if (item.icon) title = {id:id + "-header",stack:{axis:"PLUGIN_LAYOUT_AXIS_HORIZONTAL",spacing:5,children:[
        {id:id + "-icon",icon:{appearance:{accent:accent,size:"PLUGIN_COMPONENT_SIZE_COMPACT",iconSource:{systemName:item.icon}}}},
        title
      ]}};
      var children = [
        title,
        {id:id + "-value",text:{text:item.value,style:"PLUGIN_TEXT_STYLE_VALUE"}}
      ];
      // Reserve the caption line even when this metric has no change text,
      // so adjacent cards with and without captions keep the same height.
      children.push({id:id + "-change",text:{text:item.change || "\u00a0",style:"PLUGIN_TEXT_STYLE_CAPTION"}});
      var params = basicPageParams(item, detailPages[index]);
      return {id:id,card:{appearance:{accent:accent,variant:"PLUGIN_COMPONENT_VARIANT_TINTED"},
        onTap:{plugin:{actionId:"openMetricDetail",params:params}},children:children}};
    })
  }}],items.length);
});

registerTool("show_page", function(raw) {
  var input = JSON.parse(raw);
  var title = requireText(input.title,"页面标题",80);
  var cards = requireItems(input.cards,1,4).map(function(card) {
    if (!card || typeof card !== "object" || Array.isArray(card)) throw new Error("页面卡片无效");
    var item = {};
    Object.keys(card).forEach(function(key) { item[key] = card[key]; });
    item.metricIndex = 0;
    return item;
  });
  var pageCards = basicPrepareDetailPages({
    detailCards:cards,detailRows:input.rows,detailPoints:input.points
  },1)[0];
  var params = basicPageParams({label:title,value:pageCards.length + " 张卡片",detailTitle:title},pageCards);
  return showContent(title,[{id:"page-entry",card:{
    appearance:{accent:"PLUGIN_ACCENT_TEAL",variant:"PLUGIN_COMPONENT_VARIANT_TINTED"},
    onTap:{plugin:{actionId:"openCommonPage",params:params}},children:[
      {id:"page-entry-title",text:{text:title,style:"PLUGIN_TEXT_STYLE_TITLE"}},
      {id:"page-entry-description",text:{text:pageCards.length + " 张通用卡片 · 点击查看",style:"PLUGIN_TEXT_STYLE_SUBTITLE"}}
    ]
  }}],pageCards.length);
});

function registerChart(name, kind) {
  registerTool(name, function(raw) {
    var input = JSON.parse(raw);
    var items = requireItems(input.items, 2, 40).map(function(item) {
      var value = Number(item.value);
      if (!isFinite(value) || Math.abs(value) > 1000000000000 || (kind === "pie_chart" && value <= 0)) throw new Error("图表数值无效");
      return {label:requireText(item.label,"数据名称",50),value:value};
    });
    var title = requireText(input.title,"标题",80);
    var chartKind = kind === "pie_chart" ? "PLUGIN_CHART_KIND_DONUT" : kind === "line_chart" ? "PLUGIN_CHART_KIND_LINE" : "PLUGIN_CHART_KIND_BAR";
    return showContent(title,[{id:"chart",chart:{title:title,kind:chartKind,points:items}}],items.length);
  });
}
registerChart("show_pie_chart","pie_chart");
registerChart("show_line_chart","line_chart");
registerChart("show_bar_chart","bar_chart");

function dashboard(ctx) {
  return {title:"基础卡片",components:[
    {id:"system-components-entry",card:{
      appearance:{accent:"PLUGIN_ACCENT_BLUE",variant:"PLUGIN_COMPONENT_VARIANT_TINTED"},
      onTap:{navigate:{surface:"detail",route:"system-components"}},children:[
        {id:"system-components-title",text:{text:"系统组件",style:"PLUGIN_TEXT_STYLE_TITLE"}},
        {id:"system-components-description",text:{text:"查看当前支持的全部组件和交互示例",style:"PLUGIN_TEXT_STYLE_SUBTITLE"}}
      ]}},
    {id:"common-cards-entry",card:{
      appearance:{accent:"PLUGIN_ACCENT_TEAL",variant:"PLUGIN_COMPONENT_VARIANT_TINTED"},
      onTap:{navigate:{surface:"detail",route:"common-cards"}},children:[
        {id:"common-cards-title",text:{text:"通用卡片",style:"PLUGIN_TEXT_STYLE_TITLE"}},
        {id:"common-cards-description",text:{text:"查看指标、摘要、明细和图表卡组成的页面",style:"PLUGIN_TEXT_STYLE_SUBTITLE"}}
      ]}}
  ]};
}
