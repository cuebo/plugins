const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const manifest = require("./plugin.json");
assert.equal(manifest.tools.length, 6);
assert.ok(manifest.tools.some(tool => tool.name === "show_page"));
assert.ok(manifest.files["scripts/card-catalog.js"]);

const tools = {};
const storage = new Map();
let shown;
const sandbox = {
  registerTool(name, run) { tools[name] = run; },
  host: {
    ui(action, payload) {
      assert.equal(action, "show");
      shown = JSON.parse(payload);
      return '{"ok":true}';
    },
    storage(action, key, value) {
      if (action === "get") return storage.get(key) ?? "null";
      if (action === "put") {
        storage.set(key, value);
        return '{"saved":true}';
      }
      if (action === "delete") {
        storage.delete(key);
        return '{"deleted":true}';
      }
      throw new Error("Unexpected storage action");
    }
  }
};
vm.createContext(sandbox);
for (const file of ["scripts/card-catalog.js", "scripts/cuebo-ui-demo.js", "main.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), sandbox, {filename: file});
}
const pageTool = manifest.tools.find(tool => tool.name === "show_page");
for (const type of Object.keys(sandbox.basicCommonCardTypes)) {
  assert.ok(pageTool.description.includes(type));
}

const home = sandbox.dashboard({});
assert.equal(home.components.length, 2);
assert.equal(home.components[0].card.onTap.navigate.route, "system-components");
assert.equal(home.components[1].card.onTap.navigate.route, "common-cards");
const systemPage = sandbox.detail({route: "system-components"});
assert.equal(systemPage.components[1].grid.children.length, 36);
const commitDemo = systemPage.components[1].grid.children.find(node => node.id === "component-commit-activity-catalog-card");
assert.equal(commitDemo.card.onTap.navigate.route, "component:component-commit-activity");
const commitSheet = sandbox.sheet({route: "component:component-commit-activity"});
const commitChart = commitSheet.components.find(node => node.id === "render-commit-activity");
assert.equal(commitChart.card.children[2].chart.kind, "PLUGIN_CHART_KIND_AREA");
assert.equal(commitChart.card.children[2].chart.points.length, 6);
const commonPage = sandbox.detail({route: "common-cards"});
assert.equal(commonPage.components.length, 4);
assert.ok(commonPage.components[0].card && commonPage.components[1].card && commonPage.components[3].card);
assert.equal(commonPage.components[2].card, undefined);
assert.equal(commonPage.components[2].descriptionList.title, "设备明细");

const value = "在线 · 4 台\n室内机全关";
const result = JSON.parse(tools.show_metrics(JSON.stringify({items: [
  {label: "客厅空调网关", value, change: "室内均 19 °C", trend: "flat", icon: "air.conditioner.horizontal"}
]})));
assert.equal(result.shown, true);
assert.equal(shown.components[0].id, "metricCards");
const plainAction = shown.components[0].grid.children[0].card.onTap.plugin;
assert.equal(plainAction.actionId, "openMetricDetail");
assert.equal(shown.components[0].grid.children[0].card.expandOnTap, undefined);
assert.equal(sandbox.actions.openMetricDetail({params: plainAction.params}).effects[0].navigate.surface, "sheet");
const plainPage = sandbox.sheet({route: "metric-detail"});
assert.equal(plainPage.components.length, 1);
assert.equal(plainPage.components[0].card.children[1].text.text, value);
assert.equal(plainPage.components[0].card.children[1].text.style, "PLUGIN_TEXT_STYLE_DISPLAY");
assert.equal(storage.size, 0);

tools.show_metrics(JSON.stringify({
  items: [{label: "客厅状态", value: "全部关闭", detailTitle: "客厅设备详情"}],
  detailCards: [
    {metricIndex: 0, cardKey: "state", type: "metric", name: "空调", value: "关", subtitle: "在线"},
    {metricIndex: 0, cardKey: "summary", type: "summary", name: "结论", body: "灯光和空调均未运行。"},
    {metricIndex: 0, cardKey: "devices", type: "detailList", name: "设备明细"},
    {metricIndex: 0, cardKey: "temperature", type: "chart", name: "室温趋势", chartKind: "line"}
  ],
  detailRows: [{cardKey: "devices", name: "主灯", value: "关"}],
  detailPoints: [{cardKey: "temperature", label: "10:00", value: 21},
    {cardKey: "temperature", label: "11:00", value: 22}]
}));
const composedAction = shown.components[0].grid.children[0].card.onTap.plugin;
assert.equal(Object.keys(composedAction.params).filter(key => key.startsWith("card")).length, 4);
assert.ok(Object.values(composedAction.params).every(value => Buffer.byteLength(value) <= 1000));
sandbox.actions.openMetricDetail({params: composedAction.params});
const composedPage = sandbox.sheet({route: "metric-detail"});
assert.equal(composedPage.title, "客厅设备详情");
assert.equal(composedPage.components.length, 4);
assert.equal(composedPage.components[0].card.children[1].text.text, "关");
assert.equal(composedPage.components[1].card.children[1].text.text, "灯光和空调均未运行。");
assert.equal(composedPage.components[2].card, undefined);
assert.equal(composedPage.components[2].descriptionList.items[0].title, "主灯");
assert.equal(composedPage.components[3].card.children[0].chart.points.length, 2);
assert.equal(storage.size, 0);

const pageResult = JSON.parse(tools.show_page(JSON.stringify({
  title: "家庭概览",
  cards: [
    {cardKey: "overview", type: "summary", name: "结论", body: "当前没有设备运行。"},
    {cardKey: "lights", type: "detailList", name: "灯光"}
  ],
  rows: [{cardKey: "lights", name: "客厅主灯", value: "关"}]
})));
assert.equal(pageResult.shown, true);
assert.equal(pageResult.count, 2);
const pageAction = shown.components[0].card.onTap.plugin;
assert.equal(pageAction.actionId, "openCommonPage");
assert.equal(sandbox.actions.openCommonPage({params: pageAction.params}).effects[0].navigate.route, "common-page");
const standalonePage = sandbox.sheet({route: "common-page"});
assert.equal(standalonePage.title, "家庭概览");
assert.equal(standalonePage.components.length, 2);
assert.equal(standalonePage.components[1].descriptionList.items[0].title, "客厅主灯");
assert.equal(standalonePage.components[1].card, undefined);
assert.equal(storage.size, 0);

assert.throws(() => tools.show_metrics(JSON.stringify({items: [{label: "测试", value: "1"}],
  detailCards: [{metricIndex: 0, cardKey: "unknown", type: "invented", name: "未知"}]
})), /详情卡片定义无效/);

console.log("basic card pages passed");
