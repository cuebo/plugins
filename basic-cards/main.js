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

registerTool("show_list", function(raw) {
  var input = JSON.parse(raw);
  var items = requireItems(input.items, 1, 40).map(function(item) {
    var url = optionalURL(item.url);
    if (!url) throw new Error("条目链接无效");
    return {title:requireText(item.title,"条目标题",100),
      subtitle:requireText(item.subtitle,"条目说明",240),url:url,
      image_url:optionalURL(item.image_url)};
  });
  return showContent("链接列表",[{id:"links",list:{items:items.map(function(item) {
    return {title:item.title,subtitle:item.subtitle,imageURL:item.image_url,onTap:{openURL:item.url}};
  })}}],items.length);
});

registerTool("show_metrics", function(raw) {
  var input = JSON.parse(raw);
  var items = requireItems(input.items, 1, 4).map(function(item) {
    var change = typeof item.change === "string" ? item.change : "";
    var trend = typeof item.trend === "string" ? item.trend : "";
    if ((change && ["up","down","flat"].indexOf(trend) < 0) || (!change && trend)) throw new Error("趋势无效");
    return {label:requireText(item.label,"指标名称",50),value:requireText(item.value,"指标数值",80),change:change,trend:trend};
  });
  return showContent("指标",[{id:"metrics",grid:{columns:2,spacing:10,
    appearance:{container:"PLUGIN_CONTAINER_STYLE_NONE"},
    children:items.map(function(item,index) {
      var id = "metric-" + index;
      var accent = item.trend === "up" ? "PLUGIN_ACCENT_GREEN" : item.trend === "down" ? "PLUGIN_ACCENT_RED" : "PLUGIN_ACCENT_BLUE";
      var children = [
        {id:id + "-label",text:{text:item.label,style:"PLUGIN_TEXT_STYLE_CAPTION"}},
        {id:id + "-value",text:{text:item.value,style:"PLUGIN_TEXT_STYLE_VALUE"}}
      ];
      if (item.change) children.push({id:id + "-change",badge:{text:item.change,appearance:{accent:accent}}});
      return {id:id,card:{appearance:{accent:accent,variant:"PLUGIN_COMPONENT_VARIANT_TINTED"},children:children}};
    })
  }}],items.length);
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
  var page = detail(ctx);
  page.title = "基础卡片 · 组件演示";
  return page;
}
