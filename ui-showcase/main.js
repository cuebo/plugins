// The same page and action definitions serve the plugin entry and its chat card.
var SHOWCASE_IMAGE = "https://raw.githubusercontent.com/cuebo/plugins/main/ui-showcase/assets/cuebo-demo.png";
var SHOWCASE_URL = "https://github.com/cuebo/plugins/tree/main/ui-showcase";

function page(title, nodes, children) {
  nodes.push({id: "root", component: "Column", children: children});
  return {title: title, components: nodes};
}

function stored(key, fallback) {
  var value = JSON.parse(host.storage("get", key, ""));
  return value === null ? fallback : value;
}

function save(key, value) {
  host.storage("put", key, JSON.stringify(value));
}

function dashboard() {
  var count = stored("count", 0);
  return page("界面组件演示", [
    {id: "heading", component: "Text", text: "插件 UI 组件演示", variant: "h3"},
    {id: "intro", component: "Text", text: "从这里进入各组组件。页面、弹层和对话卡片共用插件脚本。", variant: "body"},
    {id: "hero", component: "Image", url: SHOWCASE_IMAGE, fit: "contain"},
    {id: "badge", component: "Badge", text: "本地演示 · 无账号"},
    {id: "count", component: "Value", title: "点击次数", value: String(count)},
    {id: "summary", component: "Row", children: ["badge", "count"]},
    {id: "progress", component: "Progress", title: "组件覆盖", value: 34, total: 34},
    {id: "sections", component: "Text", text: "按类别体验", variant: "h3"},
    {id: "layout", component: "Button", title: "排版与容器", action: {navigate: {surface: "detail", route: "layout"}}},
    {id: "data", component: "Button", title: "数据与列表", action: {navigate: {surface: "detail", route: "data"}}},
    {id: "charts", component: "Button", title: "图表与指标", action: {navigate: {surface: "detail", route: "charts"}}},
    {id: "controls", component: "Button", title: "交互与表单", action: {navigate: {surface: "detail", route: "controls"}}},
    {id: "state", component: "Button", title: "状态与反馈", action: {navigate: {surface: "detail", route: "state"}}},
    {id: "grid", component: "Grid", columns: 2, children: ["layout", "data", "charts", "controls", "state"]},
    {id: "quick", component: "Button", title: "打开快捷弹层", action: {navigate: {surface: "sheet", route: "quick"}}}
  ], ["heading", "intro", "hero", "summary", "progress", "sections", "grid", "quick"]);
}

function layoutPage() {
  return page("排版与容器", [
    {id: "heading", component: "Text", text: "排版与容器", variant: "h3"},
    {id: "caption", component: "Text", text: "Text · Icon · Row · Stack · Card · List · Grid · Divider · Spacer · CodeBlock", variant: "caption"},
    {id: "icon", component: "Icon", name: "square.stack.3d.up"},
    {id: "label", component: "Text", text: "横向 Row"},
    {id: "row", component: "Row", children: ["icon", "label"]},
    {id: "divider", component: "Divider"},
    {id: "left", component: "Text", text: "左侧"},
    {id: "spacer", component: "Spacer", length: 8},
    {id: "right", component: "Badge", text: "右侧"},
    {id: "stack", component: "Stack", axis: "horizontal", children: ["left", "spacer", "right"]},
    {id: "cardTitle", component: "Text", text: "Card 容器", variant: "h3"},
    {id: "cardBody", component: "Text", text: "内部可以放多个组件，圆角和背景由 App 渲染。"},
    {id: "card", component: "Card", children: ["cardTitle", "cardBody"]},
    {id: "listTitle", component: "Text", text: "纵向 List", variant: "h3"},
    {id: "itemA", component: "Value", title: "第一行", value: "文本"},
    {id: "itemB", component: "Value", title: "第二行", value: "数值"},
    {id: "list", component: "List", children: ["itemA", "itemB"]},
    {id: "gridTitle", component: "Text", text: "两列 Grid", variant: "h3"},
    {id: "tileA", component: "Badge", text: "A"},
    {id: "tileB", component: "Badge", text: "B"},
    {id: "tileC", component: "Badge", text: "C"},
    {id: "grid", component: "Grid", columns: 2, children: ["tileA", "tileB", "tileC"]},
    {id: "code", component: "CodeBlock", title: "脚本片段", code: "function dashboard() { return {title: '演示', components: [...]}; }"},
    {id: "url", component: "Button", title: "查看 GitHub 源码", action: {openURL: SHOWCASE_URL}}
  ], ["heading", "caption", "row", "divider", "stack", "card", "listTitle", "list", "gridTitle", "grid", "code", "url"]);
}

function dataPage() {
  return page("数据与列表", [
    {id: "heading", component: "Text", text: "数据与列表", variant: "h3"},
    {id: "value", component: "Value", title: "Value", value: "42"},
    {id: "infoTitle", component: "Text", text: "CueboInfo", variant: "h3"},
    {id: "info", component: "CueboInfo", items: [
      {label: "运行状态", subtitle: "点按展开", value: "正常运行，数据来自插件演示脚本。"},
      {label: "数据归属", value: "每个 Agent 的插件数据单独保存。"}
    ]},
    {id: "descriptionTitle", component: "Text", text: "DescriptionList", variant: "h3"},
    {id: "description", component: "DescriptionList", items: [
      {label: "版本", value: "1.0.0"}, {label: "展示方式", value: "原生组件树"}
    ]},
    {id: "linksTitle", component: "Text", text: "CueboLinkList", variant: "h3"},
    {id: "links", component: "CueboLinkList", items: [
      {title: "插件仓库", subtitle: "查看这个演示插件的源码", url: SHOWCASE_URL},
      {title: "Cuebo 项目", subtitle: "查看 App 仓库", url: "https://github.com/lovercode/agent-photo"}
    ]},
    {id: "tableTitle", component: "Text", text: "Table", variant: "h3"},
    {id: "table", component: "Table", columns: [
      {key: "name", title: "组件"}, {key: "status", title: "状态"}
    ], rows: [
      {values: {name: "Text", status: "已展示"}},
      {values: {name: "Table", status: "已展示"}},
      {values: {name: "Form", status: "见交互页"}}
    ]}
  ], ["heading", "value", "infoTitle", "info", "descriptionTitle", "description", "linksTitle", "links", "tableTitle", "table"]);
}

function chartsPage() {
  var points = [
    {label: "周一", value: 12}, {label: "周二", value: 18},
    {label: "周三", value: 15}, {label: "周四", value: 23}
  ];
  return page("图表与指标", [
    {id: "heading", component: "Text", text: "图表与指标", variant: "h3"},
    {id: "metrics", component: "CueboMetrics", items: [
      {label: "请求数", value: "128", change: "+12%", trend: "up"},
      {label: "延迟", value: "42 ms", change: "-8%", trend: "down"}
    ]},
    {id: "progress", component: "Progress", title: "Progress", value: 72, total: 100},
    {id: "circular", component: "CircularProgress", title: "CircularProgress", value: 72, total: 100},
    {id: "segments", component: "SegmentedGauge", title: "SegmentedGauge", segments: [
      {label: "已完成", value: 60}, {label: "进行中", value: 25}, {label: "未开始", value: 15}
    ]},
    {id: "barTitle", component: "Text", text: "Chart · 柱状图", variant: "h3"},
    {id: "bar", component: "Chart", chartType: "bar_chart", items: points},
    {id: "lineTitle", component: "Text", text: "MultiLineChart · 折线图", variant: "h3"},
    {id: "line", component: "MultiLineChart", chartType: "line_chart", items: points},
    {id: "pieTitle", component: "Text", text: "CueboChart · 饼图", variant: "h3"},
    {id: "pie", component: "CueboChart", chartType: "pie_chart", items: [
      {label: "页面", value: 4}, {label: "动作", value: 3}, {label: "卡片", value: 1}
    ]}
  ], ["heading", "metrics", "progress", "circular", "segments", "barTitle", "bar", "lineTitle", "line", "pieTitle", "pie"]);
}

function controlsPage() {
  var enabled = stored("enabled", false);
  var level = stored("level", 35);
  return page("交互与表单", [
    {id: "heading", component: "Text", text: "交互与表单", variant: "h3"},
    {id: "hint", component: "Text", text: "操作只会改变此 Agent 的演示数据。", variant: "caption"},
    {id: "toggle", component: "Toggle", title: "Toggle", isOn: enabled, action: {plugin: {actionID: "saveToggle"}}},
    {id: "slider", component: "Slider", title: "Slider", value: level, min: 0, max: 100, action: {plugin: {actionID: "saveSlider"}}},
    {id: "menu", component: "ActionMenu", title: "ActionMenu", items: [
      {title: "显示提示", action: {plugin: {actionID: "ping"}}},
      {title: "打开帮助弹层", action: {navigate: {surface: "sheet", route: "help"}}}
    ]},
    {id: "tabOne", component: "Text", text: "第一个 Tab 的内容"},
    {id: "tabTwo", component: "Badge", text: "第二个 Tab"},
    {id: "tabs", component: "Tabs", tabs: [
      {id: "first", title: "文字", children: ["tabOne"]},
      {id: "second", title: "标签", children: ["tabTwo"]}
    ]},
    {id: "disclosureBody", component: "Text", text: "Disclosure 可展开或收起子组件。"},
    {id: "disclosure", component: "Disclosure", title: "展开说明", children: ["disclosureBody"]},
    {id: "form", component: "Form", title: "Form", submitTitle: "提交到弹层", fields: [
      {id: "note", title: "留言", type: "text"},
      {id: "secret", title: "私密输入（不会保存）", type: "secret"},
      {id: "agree", title: "同意演示", type: "boolean"}
    ], action: {plugin: {actionID: "saveForm"}}},
    {id: "reset", component: "Confirm", title: "Confirm · 重置演示数据", message: "清除本插件在当前 Agent 下的演示数据？", confirmTitle: "重置", action: {plugin: {actionID: "reset"}}}
  ], ["heading", "hint", "toggle", "slider", "menu", "tabs", "disclosure", "form", "reset"]);
}

function statePage() {
  var count = stored("count", 0);
  return page("状态与反馈", [
    {id: "heading", component: "Text", text: "状态与反馈", variant: "h3"},
    {id: "state", component: "StateBlock", title: "StateBlock", message: "这里演示空状态组件，不代表插件出错。", icon: "checkmark.circle"},
    {id: "count", component: "Value", title: "当前点击次数", value: String(count)},
    {id: "increment", component: "Button", title: "Button · 点击 +1", action: {plugin: {actionID: "increment"}}},
    {id: "replace", component: "Button", title: "Button · 局部替换内容", action: {plugin: {actionID: "replace"}}},
    {id: "sheet", component: "Button", title: "Button · 打开弹层", action: {navigate: {surface: "sheet", route: "quick"}}},
    {id: "buttons", component: "Column", children: ["increment", "replace", "sheet"]}
  ], ["heading", "state", "count", "buttons"]);
}

function detail(ctx) {
  switch (ctx.route) {
    case "layout": return layoutPage();
    case "data": return dataPage();
    case "charts": return chartsPage();
    case "controls": return controlsPage();
    case "state": return statePage();
    default: return page("页面不存在", [
      {id: "message", component: "StateBlock", title: "找不到页面", message: "请返回插件首页。", icon: "questionmark.circle"}
    ], ["message"]);
  }
}

function sheet(ctx) {
  if (ctx.route === "submitted") {
    var form = stored("form", {note: "", agree: false});
    return page("表单结果", [
      {id: "heading", component: "Text", text: "表单已提交", variant: "h3"},
      {id: "note", component: "Value", title: "留言", value: form.note || "（空）"},
      {id: "agree", component: "Value", title: "同意演示", value: form.agree ? "是" : "否"},
      {id: "privacy", component: "Text", text: "私密输入未保存，也不会显示在这里。", variant: "caption"}
    ], ["heading", "note", "agree", "privacy"]);
  }
  if (ctx.route === "help") {
    return page("交互说明", [
      {id: "heading", component: "Text", text: "交互说明", variant: "h3"},
      {id: "body", component: "Text", text: "按钮、菜单、开关、滑块和表单的动作都由插件脚本固定定义。"},
      {id: "link", component: "Button", title: "查看脚本", action: {openURL: SHOWCASE_URL}}
    ], ["heading", "body", "link"]);
  }
  return page("快捷操作", [
    {id: "heading", component: "Text", text: "快捷操作", variant: "h3"},
    {id: "body", component: "Text", text: "弹层和二级页使用相同的原生组件。"},
    {id: "ping", component: "Button", title: "显示 Toast", action: {plugin: {actionID: "ping"}}},
    {id: "toState", component: "Button", title: "前往状态页", action: {navigate: {surface: "detail", route: "state"}}}
  ], ["heading", "body", "ping", "toState"]);
}

var actions = {
  ping: function () { return {effects: [{toast: {text: "插件动作已执行"}}]}; },
  increment: function () {
    var next = stored("count", 0) + 1;
    save("count", next);
    return {effects: [{toast: {text: "点击次数：" + next}}, {refresh: {surface: "current"}}]};
  },
  saveToggle: function (ctx) {
    var value = ctx.params.value === "true";
    save("enabled", value);
    return {effects: [{toast: {text: value ? "开关已打开" : "开关已关闭"}}, {refresh: {surface: "current"}}]};
  },
  saveSlider: function (ctx) {
    var value = Math.max(0, Math.min(100, Number(ctx.params.value) || 0));
    save("level", value);
    return {effects: [{toast: {text: "滑块数值：" + value}}, {refresh: {surface: "current"}}]};
  },
  saveForm: function (ctx) {
    var note = String(ctx.params.note || "").slice(0, 200);
    save("form", {note: note, agree: ctx.params.agree === "true"});
    // The secret field is intentionally ignored.
    return {effects: [{navigate: {surface: "sheet", route: "submitted"}}]};
  },
  reset: function () {
    ["count", "enabled", "level", "form"].forEach(function (key) { host.storage("delete", key, ""); });
    return {effects: [{toast: {text: "演示数据已重置"}}, {refresh: {surface: "current"}}]};
  },
  replace: function () {
    return {effects: [{replace: {components: [
      {id: "heading", component: "Text", text: "内容已替换", variant: "h3"},
      {id: "message", component: "StateBlock", title: "Replace 生效", message: "此页面由动作返回的新组件树替换。", icon: "checkmark.circle.fill"},
      {id: "root", component: "Column", children: ["heading", "message"]}
    ]}}]};
  }
};

registerTool("show_ui_showcase", function () {
  var card = page("界面演示卡片", [
    {id: "heading", component: "Text", text: "插件 UI 演示", variant: "h3"},
    {id: "body", component: "Text", text: "点击卡片中的按钮，进入与插件首页共用的二级页面。"},
    {id: "open", component: "Button", title: "查看所有组件", action: {navigate: {surface: "detail", route: "layout"}}},
    {id: "quick", component: "Button", title: "打开弹层", action: {navigate: {surface: "sheet", route: "quick"}}}
  ], ["heading", "body", "open", "quick"]);
  var result = JSON.parse(host.ui("show", JSON.stringify({id: "showcase", title: card.title, components: card.components})));
  if (!result.ok) { return JSON.stringify({error: "展示组件卡片失败"}); }
  return JSON.stringify({message: "已展示界面组件演示卡片。"});
});
