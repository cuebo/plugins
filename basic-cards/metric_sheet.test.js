const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
      throw new Error("Unexpected storage action");
    }
  }
};
vm.createContext(sandbox);
for (const file of ["main.js", "scripts/cuebo-ui-demo.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), sandbox, {filename: file});
}

const value = "在线 · 4 台\n室内机全关";
const result = JSON.parse(tools.show_metrics(JSON.stringify({items: [
  {label: "客厅空调网关", value, change: "室内均 19 °C", trend: "flat", icon: "air.conditioner.horizontal"}
]})));
assert.equal(result.shown, true);
const grid = shown.components[0];
assert.equal(grid.id, "metricCards");
const card = grid.grid.children[0].card;
assert.equal(card.expandOnTap, undefined);
assert.equal(card.onTap.plugin.actionId, "openMetricDetail");

const effects = sandbox.actions.openMetricDetail({params: card.onTap.plugin.params}).effects;
assert.equal(effects[0].navigate.surface, "sheet");
assert.equal(effects[0].navigate.route, "metric-detail");
const page = sandbox.sheet({route: "metric-detail"});
assert.equal(page.title, "指标详情");
const children = page.components[0].stack.children;
assert.equal(children[0].stack.children[1].text.text, "客厅空调网关");
assert.equal(children[1].text.text, value);
assert.equal(children[1].text.style, "PLUGIN_TEXT_STYLE_DISPLAY");
assert.equal(children[2].text.text, "室内均 19 °C");
assert.equal(storage.size, 1);

tools.show_metrics(JSON.stringify({items: [{label: "客厅主灯", value: "关"}]}));
const plainAction = shown.components[0].grid.children[0].card.onTap.plugin;
sandbox.actions.openMetricDetail({params: plainAction.params});
const plainPage = sandbox.sheet({route: "metric-detail"});
assert.equal(plainPage.components[0].stack.children.length, 2);
assert.equal(plainPage.components[0].stack.children[1].text.text, "关");
assert.equal(storage.size, 1);

console.log("metric plugin sheet passed");
