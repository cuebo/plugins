// One catalog supplies validation and the fixed Cuebo UI for every common card.
// The Agent chooses card types and data; it never supplies component JSON.
var basicCommonCardTypes = {
  metric: {name: "指标卡", data: "name、value；可选 subtitle、icon、trend"},
  summary: {name: "摘要卡", data: "name、body"},
  detailList: {name: "明细卡", data: "name；明细由 detailRows 按 cardKey 提供"},
  chart: {name: "图表卡", data: "name、chartKind(line/bar/donut)；数据点由 detailPoints 按 cardKey 提供"}
};

function basicOptionalText(value, name, limit) {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || value.length > limit) throw new Error(name + "无效");
  return value.trim();
}

function basicRequiredText(value, name, limit) {
  var text = basicOptionalText(value, name, limit);
  if (!text) throw new Error(name + "无效");
  return text;
}

function basicAccent(trend) {
  return trend === "up" ? "PLUGIN_ACCENT_GREEN" : trend === "down" ? "PLUGIN_ACCENT_RED" : "PLUGIN_ACCENT_BLUE";
}

function basicUTF8Length(text) {
  var length = 0;
  for (var index = 0; index < text.length; index++) {
    var code = text.charCodeAt(index);
    if (code < 0x80) length += 1;
    else if (code < 0x800) length += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
      length += 4;
      index += 1;
    } else length += 3;
  }
  return length;
}

function basicPrepareDetailPages(input, metricCount) {
  var rawCards = input.detailCards == null ? [] : input.detailCards;
  var rawRows = input.detailRows == null ? [] : input.detailRows;
  var rawPoints = input.detailPoints == null ? [] : input.detailPoints;
  if (!Array.isArray(rawCards) || rawCards.length > 24 || !Array.isArray(rawRows) || rawRows.length > 64 ||
      !Array.isArray(rawPoints) || rawPoints.length > 80) throw new Error("详情卡片数量无效");
  var pages = [];
  for (var pageIndex = 0; pageIndex < metricCount; pageIndex++) pages.push([]);
  var byKey = Object.create(null);
  rawCards.forEach(function(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
        typeof raw.metricIndex !== "number" || Math.floor(raw.metricIndex) !== raw.metricIndex ||
        raw.metricIndex < 0 || raw.metricIndex >= metricCount ||
        typeof raw.cardKey !== "string" || !/^[a-z][a-z0-9_-]{0,31}$/.test(raw.cardKey) ||
        byKey[raw.cardKey] || !Object.prototype.hasOwnProperty.call(basicCommonCardTypes, raw.type)) {
      throw new Error("详情卡片定义无效");
    }
    var card = {
      type: raw.type, name: basicRequiredText(raw.name, "卡片名称", 50),
      value: basicOptionalText(raw.value, "指标数值", 100),
      subtitle: basicOptionalText(raw.subtitle, "指标说明", 160),
      body: basicOptionalText(raw.body, "摘要内容", 250),
      icon: basicOptionalText(raw.icon, "卡片图标", 80),
      trend: basicOptionalText(raw.trend, "指标趋势", 10),
      chartKind: basicOptionalText(raw.chartKind, "图表类型", 10),
      rows: [], points: []
    };
    if (card.icon && !/^[a-z0-9][a-z0-9.-]{0,79}$/.test(card.icon)) throw new Error("卡片图标无效");
    if (card.trend && ["up", "down", "flat"].indexOf(card.trend) < 0) throw new Error("指标趋势无效");
    if (card.type === "metric" && !card.value || card.type === "summary" && !card.body ||
        card.type === "chart" && ["line", "bar", "donut"].indexOf(card.chartKind) < 0) {
      throw new Error("详情卡片数据不完整");
    }
    if (pages[raw.metricIndex].length >= 4) throw new Error("每个指标最多四张详情卡片");
    pages[raw.metricIndex].push(card);
    byKey[raw.cardKey] = card;
  });
  rawRows.forEach(function(raw) {
    var target = raw && byKey[raw.cardKey];
    if (!target || target.type !== "detailList" || target.rows.length >= 8) throw new Error("明细行无效");
    target.rows.push({name: basicRequiredText(raw.name, "明细名称", 60),
                      value: basicRequiredText(raw.value, "明细值", 100)});
  });
  rawPoints.forEach(function(raw) {
    var target = raw && byKey[raw.cardKey];
    if (!target || target.type !== "chart" || target.points.length >= 12 ||
        typeof raw.value !== "number" || !isFinite(raw.value) || Math.abs(raw.value) > 1000000000000) {
      throw new Error("图表数据点无效");
    }
    target.points.push({label: basicRequiredText(raw.label, "数据点名称", 50), value: raw.value});
  });
  rawCards.forEach(function(raw) {
    var card = byKey[raw.cardKey];
    if (card.type === "detailList" && !card.rows.length || card.type === "chart" && card.points.length < 2) {
      throw new Error("详情卡片缺少数据");
    }
    if (basicUTF8Length(JSON.stringify(card)) > 1000) throw new Error("单张详情卡片内容过长");
  });
  return pages;
}

function basicDecodeCardParams(params) {
  var rawCards = [];
  var rawRows = [];
  var rawPoints = [];
  for (var index = 0; index < 4; index++) {
    var encoded = params["card" + index];
    if (!encoded) continue;
    if (typeof encoded !== "string" || basicUTF8Length(encoded) > 1000) throw new Error("详情卡片内容无效");
    var card = JSON.parse(encoded);
    var key = "card" + index;
    rawCards.push({metricIndex:0,cardKey:key,type:card.type,name:card.name,
      value:card.value,subtitle:card.subtitle,body:card.body,icon:card.icon,
      trend:card.trend,chartKind:card.chartKind});
    if (Array.isArray(card.rows)) card.rows.forEach(function(row) {
      rawRows.push({cardKey:key,name:row.name,value:row.value});
    });
    if (Array.isArray(card.points)) card.points.forEach(function(point) {
      rawPoints.push({cardKey:key,label:point.label,value:point.value});
    });
  }
  return basicPrepareDetailPages({detailCards:rawCards,detailRows:rawRows,detailPoints:rawPoints},1)[0];
}

function basicCommonCardNode(card, index) {
  var id = "common-card-" + index;
  var children = [];
  var accent = basicAccent(card.trend);
  if (card.type === "detailList") {
    return {id: id, descriptionList: {title: card.name,
      items: card.rows.map(function(row) { return {title: row.name, value: {text: row.value}}; })
    }};
  }
  if (card.type === "metric") {
    var heading = [{id: id + "-name", text: {text: card.name, style: "PLUGIN_TEXT_STYLE_TITLE"}}];
    if (card.icon) heading.unshift({id: id + "-icon", icon: {
      appearance: {accent: accent, iconSource: {systemName: card.icon}}
    }});
    children.push({id: id + "-heading", stack: {axis: "PLUGIN_LAYOUT_AXIS_HORIZONTAL", spacing: 8, children: heading}});
    children.push({id: id + "-value", text: {text: card.value, style: "PLUGIN_TEXT_STYLE_DISPLAY"}});
    if (card.subtitle) children.push({id: id + "-subtitle", text: {text: card.subtitle, style: "PLUGIN_TEXT_STYLE_SUBTITLE"}});
  } else if (card.type === "summary") {
    children.push({id: id + "-name", text: {text: card.name, style: "PLUGIN_TEXT_STYLE_TITLE"}});
    children.push({id: id + "-body", text: {text: card.body}});
  } else if (card.type === "chart") {
    var kind = card.chartKind === "bar" ? "PLUGIN_CHART_KIND_BAR"
      : card.chartKind === "donut" ? "PLUGIN_CHART_KIND_DONUT" : "PLUGIN_CHART_KIND_LINE";
    children.push({id: id + "-chart", chart: {title: card.name, kind: kind, height: 170, points: card.points}});
  }
  return {id: id, card: {appearance: {accent: accent, variant: "PLUGIN_COMPONENT_VARIANT_TINTED"}, children: children}};
}

function basicCommonPage(title, cards) {
  return {title: title, components: cards.map(function(card, index) { return basicCommonCardNode(card, index); })};
}

function basicCommonCardDemoPage() {
  return basicCommonPage("通用卡片", [
    {type: "metric", name: "空调设定温度", value: "27.0 °C", subtitle: "室内 22.0 °C", icon: "thermometer", trend: "flat"},
    {type: "summary", name: "客厅状态", body: "灯光和空调均已关闭，当前没有设备在运行。"},
    {type: "detailList", name: "设备明细", rows: [
      {name: "客厅主灯", value: "关"}, {name: "其他灯", value: "6 路全部关闭"}, {name: "空调", value: "在线 · 关闭"}
    ]},
    {type: "chart", name: "室温趋势", chartKind: "line", points: [
      {label: "10:00", value: 21.4}, {label: "11:00", value: 21.8},
      {label: "12:00", value: 22.1}, {label: "13:00", value: 22.0}
    ]}
  ]);
}
