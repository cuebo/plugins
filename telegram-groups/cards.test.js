const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(__dirname + "/main.js", "utf8");
const now = Math.floor(Date.now() / 1000);
const samples = [];

function plugin(responses, failUI = false) {
  const tools = {};
  const cards = [];
  const storage = {};
  const requests = [];
  const host = {
    config: () => JSON.stringify({bot_token: "12345:TEST", chat_id: ""}),
    storage: (action, key, value) => {
      if (action === "get") return JSON.stringify(storage[key] ?? null);
      storage[key] = JSON.parse(value);
      return "null";
    },
    request: raw => {
      const request = JSON.parse(raw);
      const method = request.url.split("/").pop();
      requests.push(method);
      const result = responses[method];
      if (!result) throw new Error("Unexpected Telegram method: " + method);
      return JSON.stringify({status: 200, body: JSON.stringify({ok: true,
        result: typeof result === "function" ? result(JSON.parse(request.body)) : result})});
    },
    ui: (action, raw) => {
      assert.equal(action, "show");
      if (failUI) throw new Error("UI unavailable");
      const card = JSON.parse(raw);
      assert.ok(Buffer.byteLength(raw) < 65536);
      assert.equal(card.components.length, 1);
      cards.push(card);
      return JSON.stringify({ok: true});
    }
  };
  vm.runInNewContext(source, {
    host, registerTool: (name, fn) => { tools[name] = fn; },
    registerCallback: () => {}, Date, Math, JSON, String, Number,
    Array, Object, Boolean, isFinite
  }, {filename: "main.js"});
  return {tools, cards, storage, requests};
}

function assertCard(card, title) {
  assert.equal(card.title, title);
  const ids = new Set();
  function visit(node) {
    assert.match(node.id, /^[A-Za-z][A-Za-z0-9_-]{0,63}$/);
    assert.ok(!ids.has(node.id), "duplicate node id " + node.id);
    ids.add(node.id);
    for (const value of Object.values(node)) {
      if (value && typeof value === "object" && Array.isArray(value.children))
        value.children.forEach(visit);
    }
  }
  card.components.forEach(visit);
  return JSON.stringify(card);
}

{
  const update = (id, text) => ({update_id: id, message: {
    message_id: id, date: now, chat: {id: -100123, type: "supergroup", title: "产品讨论群"},
    from: {id: 42, username: "alice"}, text
  }});
  const app = plugin({getUpdates: [update(380, "第一条"), update(381, "第二条")]});
  const result = JSON.parse(app.tools.read_new_messages());
  assert.equal(result.count, 2);
  assert.equal(result.card_shown, true);
  assert.equal(app.storage["next-update-id"], 382);
  const card = app.cards[0];
  assert.match(assertCard(card, "新消息"), /第二条/);
  samples.push(card);
  assert.equal(card.components[0].card.children[2].list.items.length, 2);
  const repeat = JSON.parse(app.tools.read_new_messages());
  assert.equal(repeat.count, 2); // The mocked server ignores offsets; plugin still advances the offset.
}

{
  const app = plugin({getChat: {title: "产品讨论群", type: "supergroup", description: "产品讨论"},
    getChatMemberCount: 1284,
    getChatAdministrators: [{user: {id: 1, username: "owner"}, status: "creator"},
      {user: {id: 2, username: "mod"}, status: "administrator"}]});
  const result = JSON.parse(app.tools.get_group_info(JSON.stringify({chat_id: "-100123"})));
  assert.equal(result.member_count, 1284);
  assert.equal(result.card_shown, true);
  assert.match(assertCard(app.cards[0], "群组资料"), /产品讨论/);
  samples.push(app.cards[0]);
  assert.equal(app.cards[0].components[0].card.children[2].grid.children.length, 2);
}

{
  const app = plugin({});
  app.storage["pending-join-requests"] = [{chat_id: "-100123", chat_title: "产品讨论群",
    user_id: "10", username: "newdesigner", date: now}];
  const result = JSON.parse(app.tools.list_join_requests());
  assert.equal(result.requests.length, 1);
  assert.equal(result.card_shown, true);
  assert.match(assertCard(app.cards[0], "入群申请"), /newdesigner/);
  samples.push(app.cards[0]);
}

{
  const app = plugin({sendMessage: {chat: {id: -100123}, message_id: 382, date: now}});
  app.storage["known-groups"] = [{id: "-100123", title: "产品讨论群"}];
  const result = JSON.parse(app.tools.send_message(JSON.stringify({chat_id: "-100123",
    text: "今晚 8 点开始测试新版"})));
  assert.equal(result.ok, true);
  assert.equal(result.card_shown, true);
  assert.match(assertCard(app.cards[0], "发送结果"), /今晚 8 点开始测试新版/);
  samples.push(app.cards[0]);
  assert.match(JSON.stringify(app.cards[0]), /Telegram 已接收/);
  assert.deepEqual(app.requests, ["sendMessage"]);
}

{
  const app = plugin({sendMessage: {chat: {id: -100123}, message_id: 383, date: now}}, true);
  const sent = JSON.parse(app.tools.send_message(JSON.stringify({chat_id: "-100123", text: "收到"})));
  const replied = JSON.parse(app.tools.reply_message(JSON.stringify({chat_id: "-100123",
    message_id: 381, text: "已回复"})));
  assert.equal(sent.ok, true);
  assert.equal(sent.card_shown, false);
  assert.equal(replied.ok, true);
  assert.equal(replied.card_shown, false);
  assert.deepEqual(app.requests, ["sendMessage", "sendMessage"]);
}

if (process.env.TELEGRAM_CARD_SAMPLES) {
  fs.writeFileSync(process.env.TELEGRAM_CARD_SAMPLES, JSON.stringify(samples, null, 2));
}
console.log("Telegram card and send-result tests passed");
