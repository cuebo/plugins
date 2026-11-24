const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const manifest = JSON.parse(fs.readFileSync(__dirname + "/plugin.json", "utf8"));
const tools = {};
const requests = [];
let token = "";
let nextResponse = null;
let networkFails = false;

const host = {
  config: () => JSON.stringify({token}),
  request: raw => {
    const request = JSON.parse(raw);
    requests.push(request);
    if (networkFails) throw new Error("network failed");
    if (nextResponse) {
      const response = nextResponse;
      nextResponse = null;
      return JSON.stringify(response);
    }
    const path = new URL(request.url).pathname;
    if (path === "/api/topics/hot.json" || path === "/api/topics/latest.json") {
      return JSON.stringify({status: 200, body: JSON.stringify([{id: 1, title: "Topic", content: "Content", content_rendered: "<p>Content</p>"}])});
    }
    if (path.startsWith("/api/nodes/show.json")) return JSON.stringify({status: 200, body: JSON.stringify({name: "python"})});
    if (path.startsWith("/api/members/show.json")) return JSON.stringify({status: 200, body: JSON.stringify({username: "Livid"})});
    if (path === "/api/v2/notifications/9" && request.method === "DELETE") return JSON.stringify({status: 204, body: ""});
    return JSON.stringify({status: request.method === "POST" ? 201 : 200, body: JSON.stringify({success: true, result: {id: 1, title: "Topic"}})});
  },
};
const context = {
  host,
  registerTool: (name, run) => { tools[name] = run; },
  JSON, Math, Number, Object, String, Array,
  encodeURIComponent,
};
vm.runInNewContext(fs.readFileSync(__dirname + "/main.js", "utf8"), context);
const invoke = (name, input = {}) => JSON.parse(tools[name](JSON.stringify(input)));
const lastRequest = () => requests[requests.length - 1];

assert.strictEqual(manifest.tools.length, 15);
assert.deepStrictEqual(manifest.tools.map(tool => tool.name).sort(), Object.keys(tools).sort());
assert(!manifest.ui && !manifest.uiProtocol && !manifest.capabilities?.includes("generative_ui"));
assert.strictEqual(context.dashboard, undefined);
assert.strictEqual(context.detail, undefined);
for (const name of ["delete_notification", "create_topic", "create_reply", "set_sticky", "boost_topic"]) {
  assert.strictEqual(manifest.tools.find(tool => tool.name === name).requiresApproval, true);
}

assert.strictEqual(invoke("hot_topics").data[0].title, "Topic");
assert.strictEqual(lastRequest().url, "https://www.v2ex.com/api/topics/hot.json");
assert.strictEqual(lastRequest().headers.Authorization, undefined);
assert.strictEqual(invoke("latest_topics").data[0].content_rendered, undefined);
assert.strictEqual(invoke("node_info", {node_name: "python"}).data.name, "python");
assert.strictEqual(invoke("member_info", {username: "Livid"}).data.username, "Livid");
assert.strictEqual(invoke("member_info", {member_id: 1}).ok, true);
assert.strictEqual(invoke("member_info", {username: "Livid", member_id: 1}).ok, false);
assert.strictEqual(invoke("node_info", {node_name: "../private"}).ok, false);

const beforeAuth = requests.length;
assert.strictEqual(invoke("my_profile").ok, false);
assert.strictEqual(requests.length, beforeAuth);
token = "test-personal-token";
assert.strictEqual(invoke("latest_topics_page", {page: 2}).ok, true);
assert.strictEqual(lastRequest().url, "https://edge.v2ex.com/api/v2/topics/latest?p=2");
assert.strictEqual(lastRequest().headers.Authorization, "Bearer test-personal-token");
assert.strictEqual(invoke("node_topics", {node_name: "python"}).ok, true);
assert.strictEqual(lastRequest().url, "https://edge.v2ex.com/api/v2/nodes/python/topics?p=1");
assert.strictEqual(invoke("topic", {topic_id: 1}).ok, true);
assert.strictEqual(invoke("topic_replies", {topic_id: 1, page: 2}).ok, true);
assert.strictEqual(invoke("my_profile").ok, true);
assert.strictEqual(invoke("notifications").ok, true);
assert.strictEqual(invoke("notifications", {page: 0}).ok, false);
assert.strictEqual(invoke("topic", {topic_id: true}).ok, false);
assert.strictEqual(invoke("delete_notification", {notification_id: 9}).status, 204);

assert.strictEqual(invoke("create_topic", {node_name: "python", title: "Hello", content: "Text"}).ok, true);
assert.strictEqual(lastRequest().method, "POST");
assert.strictEqual(lastRequest().url, "https://edge.v2ex.com/api/v2/topics");
assert.deepStrictEqual(JSON.parse(lastRequest().body), {node_name: "python", title: "Hello", content: "Text", syntax: "markdown"});
assert.strictEqual(invoke("create_topic", {node_name: "python", title: "  "}).ok, false);
assert.strictEqual(invoke("create_topic", {node_name: "python", title: {text: "Hello"}}).ok, false);
assert.strictEqual(invoke("create_topic", {node_name: "python", title: "Hello", syntax: "html"}).ok, false);
assert.strictEqual(invoke("create_reply", {topic_id: 1, content: "Reply"}).ok, true);
assert.strictEqual(lastRequest().url, "https://edge.v2ex.com/api/v2/topics/1/replies");
assert.strictEqual(invoke("create_reply", {topic_id: 1, content: ""}).ok, false);
assert.strictEqual(invoke("set_sticky", {topic_id: 1, duration: "1hr"}).ok, true);
assert.strictEqual(lastRequest().url, "https://edge.v2ex.com/api/v2/topics/1/set-sticky?duration=1hr");
assert.strictEqual(invoke("set_sticky", {topic_id: 1, duration: "1day"}).ok, false);
assert.strictEqual(invoke("boost_topic", {topic_id: 1}).ok, true);
assert.strictEqual(lastRequest().url, "https://edge.v2ex.com/api/v2/topics/1/boost");

nextResponse = {status: 403, body: JSON.stringify({success: false, message: "PRO required"})};
assert.strictEqual(invoke("create_reply", {topic_id: 1, content: "Reply"}).error, "PRO required");
nextResponse = {status: 429, body: JSON.stringify({success: false, message: "rate limited"})};
assert.strictEqual(invoke("notifications").status, 429);
nextResponse = {status: 401, body: JSON.stringify({success: false, message: `Token ${token} expired`})};
assert(!JSON.stringify(invoke("my_profile")).includes(token));
nextResponse = {status: 200, body: JSON.stringify({success: true, data: {username: "Livid"}})};
assert.strictEqual(invoke("my_profile").data.username, "Livid");
networkFails = true;
assert.strictEqual(invoke("notifications").ok, false);
networkFails = false;
assert(!JSON.stringify(invoke("my_profile")).includes(token));
console.log("V2EX plugin tests passed");
