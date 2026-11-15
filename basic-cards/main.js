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

function showContent(title, component) {
  var id = "basic" + Date.now().toString(36) + Math.floor(Math.random() * 1000000000).toString(36);
  var response = JSON.parse(host.ui("show", JSON.stringify({
    id:id,title:title,components:[component,{id:"root",component:"Column",children:[component.id]}]
  })));
  return JSON.stringify({shown:response.ok === true,count:component.items.length});
}

registerTool("show_list", function(raw) {
  var input = JSON.parse(raw);
  var items = requireItems(input.items, 1, 40).map(function(item) {
    var url = optionalURL(item.url);
    if (!url) throw new Error("条目链接无效");
    return {title:requireText(item.title,"条目标题",100),
      subtitle:requireText(item.subtitle,"条目说明",240),url:url,
      image_url:optionalURL(item.image_url)};
  });
  return showContent("链接列表",{id:"links",component:"CueboLinkList",items:items});
});

registerTool("show_metrics", function(raw) {
  var input = JSON.parse(raw);
  var items = requireItems(input.items, 1, 4).map(function(item) {
    var change = typeof item.change === "string" ? item.change : "";
    var trend = typeof item.trend === "string" ? item.trend : "";
    if ((change && ["up","down","flat"].indexOf(trend) < 0) || (!change && trend)) throw new Error("趋势无效");
    return {label:requireText(item.label,"指标名称",50),value:requireText(item.value,"指标数值",80),change:change,trend:trend};
  });
  return showContent("指标",{id:"metrics",component:"CueboMetrics",items:items});
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
    var nodes = [
      {id:"chart",component:"CueboChart",chartType:kind,items:items},
      {id:"title",component:"Text",text:title,variant:"h3",align:"center"},
      {id:"root",component:"Column",children:["chart","title"]}
    ];
    var id = "basic" + Date.now().toString(36) + Math.floor(Math.random() * 1000000000).toString(36);
    var response = JSON.parse(host.ui("show", JSON.stringify({id:id,title:title,components:nodes})));
    return JSON.stringify({shown:response.ok === true,count:items.length});
  });
}
registerChart("show_pie_chart","pie_chart");
registerChart("show_line_chart","line_chart");
registerChart("show_bar_chart","bar_chart");

function dashboard() {
  return {title:"基础卡片",components:[
    {id:"title",component:"Text",text:"基础卡片",variant:"h3"},
    {id:"hint",component:"Text",text:"在对话中展示链接列表、指标和图表。插件只接收内容，布局由固定脚本生成。",variant:"body"},
    {id:"types",component:"Text",text:"链接列表 · 指标 · 饼图 · 折线图 · 柱状图",variant:"body"},
    {id:"root",component:"Column",children:["title","hint","types"]}
  ]};
}
