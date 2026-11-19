const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(__dirname + "/main.js", "utf8");
const manifest = JSON.parse(fs.readFileSync(__dirname + "/plugin.json", "utf8"));
assert.deepStrictEqual(manifest.capabilities, ["ish_shell", "generative_ui"]);

function run(options = {}) {
  const tools = {};
  const commands = [];
  const cards = [];
  const inspect = options.inspect || {id:"a".repeat(64),name:"/prowlarr",image:"linuxserver/prowlarr:latest",
    state:"running",port_count:2,volume_count:1};
  const stats = options.stats || {ID:"a".repeat(12),CPUPerc:"0.2%",MemPerc:"1.3%",NetIO:"0B / 0B"};
  const host = {
    call: (action, raw) => {
      assert.strictEqual(action, "shell.execute");
      const request = JSON.parse(raw);
      assert.deepStrictEqual(Object.keys(request), ["command"]);
      commands.push(request.command);
      if (request.command.startsWith("docker ps")) return JSON.stringify({output:JSON.stringify({ID:"a".repeat(12),Names:"prowlarr",Image:inspect.image,Status:"Up 2 hours"}),exitCode:0,truncated:false});
      if (request.command.startsWith("docker inspect")) return JSON.stringify({output:JSON.stringify(inspect),exitCode:0,truncated:false});
      if (request.command.startsWith("docker stats")) return JSON.stringify({output:JSON.stringify(stats),exitCode:0,truncated:false});
      throw new Error("unexpected command");
    },
    ui: (action, raw) => { assert.strictEqual(action, "show"); cards.push(JSON.parse(raw)); return JSON.stringify({ok:true}); }
  };
  vm.runInNewContext(source, {host, registerTool:(name, handler) => {tools[name] = handler;},
    JSON, Date, Math, Number, String, isFinite, Error});
  return {tools, commands, cards};
}

function flatten(nodes, result = []) {
  for (const node of nodes) {
    result.push(node);
    const content = node[Object.keys(node).find(key => key !== "id")];
    if (content && content.children) flatten(content.children, result);
  }
  return result;
}

const running = run();
assert.strictEqual(JSON.parse(running.tools.list_containers("{}" )).containers[0].name, "prowlarr");
const result = JSON.parse(running.tools.show_container(JSON.stringify({container:"prowlarr"})));
assert.strictEqual(result.shown, true);
assert.strictEqual(result.cpu_percent, 0.2);
assert.strictEqual(result.memory_percent, 1.3);
assert.deepStrictEqual(Object.keys(result.network_io), ["rx", "tx"]);
assert.strictEqual(running.commands.length, 3);
assert(running.commands[1].includes("docker inspect --type container"));
assert(running.commands[2].includes("docker stats --no-stream"));
assert.strictEqual(running.cards[0].components[0].card.appearance.variant, "PLUGIN_COMPONENT_VARIANT_DARK");
const nodes = flatten(running.cards[0].components);
assert.strictEqual(new Set(nodes.map(node => node.id)).size, nodes.length);
for (const value of ["prowlarr", "linuxserver/prowlarr:latest", "0.2%", "1.3%", "0B", "2 端口", "1 卷"]) {
  assert(JSON.stringify(nodes).includes(value), value);
}
assert(!nodes.some(node => node.button), "card should not expose nonfunctional controls");

const stopped = run({inspect:{id:"b".repeat(64),name:"/idle",image:"alpine:latest",state:"exited",port_count:0,volume_count:0}});
const stoppedResult = JSON.parse(stopped.tools.show_container(JSON.stringify({container:"idle"})));
assert.strictEqual(stoppedResult.state, "exited");
assert.strictEqual(stopped.commands.length, 1);
assert(!JSON.stringify(stopped.cards[0]).includes("dockerMetrics"));

const injection = run();
assert.throws(() => injection.tools.show_container(JSON.stringify({container:"foo; rm -rf /"})), /无效/);
assert.strictEqual(injection.commands.length, 0);

const mismatch = run({stats:{ID:"c".repeat(12),CPUPerc:"0%",MemPerc:"0%",NetIO:"0B / 0B"}});
const mismatchResult = JSON.parse(mismatch.tools.show_container(JSON.stringify({container:"prowlarr"})));
assert(mismatchResult.stats_error.includes("不匹配"));
assert(!JSON.stringify(mismatch.cards[0]).includes("dockerMetrics"));
