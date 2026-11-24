var V2EX_PUBLIC = "https://www.v2ex.com";
var V2EX_ACCOUNT = "https://edge.v2ex.com/api/v2";

function v2exInput(raw) {
  var value = JSON.parse(raw || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("参数必须是对象");
  return value;
}

function v2exName(value, label) {
  var name = String(value == null ? "" : value).trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) throw new Error(label + "无效");
  return name;
}

function v2exID(value, label) {
  if (typeof value !== "number" && (typeof value !== "string" || !/^[0-9]+$/.test(value))) throw new Error(label + "无效");
  var number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(label + "无效");
  return number;
}

function v2exPage(value) {
  if (value == null) return 1;
  var page = v2exID(value, "页码");
  if (page > 1000) throw new Error("页码不能超过 1000");
  return page;
}

function v2exText(value, label, max, required) {
  if (value != null && typeof value !== "string") throw new Error(label + "必须是文本");
  var content = (value || "").trim();
  if (required && !content) throw new Error(label + "不能为空");
  if (content.length > max) throw new Error(label + "不能超过 " + max + " 字符");
  return content;
}

function v2exToken() {
  var config = JSON.parse(host.config() || "{}");
  var token = typeof config.token === "string" ? config.token.trim() : "";
  if (!token) throw new Error("请先在此 Agent 的 V2EX 插件配置中填写 Personal Access Token");
  return token;
}

function v2exPrune(value, depth, textLimit) {
  if (depth > 7) return null;
  if (typeof value === "string") return value.length > textLimit ? value.slice(0, textLimit) + "…" : value;
  if (Array.isArray(value)) return value.slice(0, 30).map(function(item) { return v2exPrune(item, depth + 1, textLimit); });
  if (value && typeof value === "object") {
    var result = {};
    Object.keys(value).slice(0, 50).forEach(function(key) {
      if (key === "content_rendered") return;
      result[key] = v2exPrune(value[key], depth + 1, textLimit);
    });
    return result;
  }
  return value;
}

function v2exRequest(method, path, body, account, textLimit) {
  var headers = {"Accept": "application/json"};
  var token = account ? v2exToken() : "";
  if (account) headers.Authorization = "Bearer " + token;
  if (body != null) headers["Content-Type"] = "application/json";
  var request = {method: method, url: (account ? V2EX_ACCOUNT : V2EX_PUBLIC) + path, headers: headers};
  if (body != null) request.body = JSON.stringify(body);
  var response;
  try {
    response = JSON.parse(host.request(JSON.stringify(request)));
  } catch (_) {
    return {ok: false, error: "V2EX 请求失败，请检查网络连接与此插件的域名授权"};
  }
  var payload = null;
  if (response.body) {
    try { payload = JSON.parse(response.body); }
    catch (_) { return {ok: false, status: response.status, error: "V2EX 返回了无法解析的响应"}; }
  }
  if (response.status < 200 || response.status >= 300 || payload && payload.success === false) {
    var message = payload && typeof payload.message === "string" ? payload.message : "V2EX API 请求失败";
    if (response.status === 429) message = "V2EX API 请求过于频繁，请稍后重试";
    if (token) message = message.split(token).join("[redacted]");
    return {ok: false, status: response.status, error: message.slice(0, 240)};
  }
  var data = payload && Object.prototype.hasOwnProperty.call(payload, "result") ? payload.result :
    payload && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
  return {ok: true, status: response.status, data: v2exPrune(data, 0, textLimit || 1200)};
}

function v2exTool(fn) {
  return function(raw) {
    try { return JSON.stringify(fn(v2exInput(raw))); }
    catch (error) { return JSON.stringify({ok: false, error: String(error && error.message || error)}); }
  };
}

registerTool("hot_topics", v2exTool(function() {
  return v2exRequest("GET", "/api/topics/hot.json", null, false, 800);
}));

registerTool("latest_topics", v2exTool(function() {
  return v2exRequest("GET", "/api/topics/latest.json", null, false, 800);
}));

registerTool("node_info", v2exTool(function(a) {
  return v2exRequest("GET", "/api/nodes/show.json?name=" + encodeURIComponent(v2exName(a.node_name, "节点名称")), null, false);
}));

registerTool("member_info", v2exTool(function(a) {
  var hasName = a.username != null && String(a.username).trim() !== "";
  var hasID = a.member_id != null;
  if (hasName === hasID) throw new Error("请只填写用户名或用户数字 ID 中的一项");
  var query = hasName ? "username=" + encodeURIComponent(v2exName(a.username, "用户名")) : "id=" + v2exID(a.member_id, "用户 ID");
  return v2exRequest("GET", "/api/members/show.json?" + query, null, false);
}));

registerTool("latest_topics_page", v2exTool(function(a) {
  return v2exRequest("GET", "/topics/latest?p=" + v2exPage(a.page), null, true, 800);
}));

registerTool("node_topics", v2exTool(function(a) {
  return v2exRequest("GET", "/nodes/" + encodeURIComponent(v2exName(a.node_name, "节点名称")) + "/topics?p=" + v2exPage(a.page), null, true, 800);
}));

registerTool("topic", v2exTool(function(a) {
  return v2exRequest("GET", "/topics/" + v2exID(a.topic_id, "主题 ID"), null, true, 20000);
}));

registerTool("topic_replies", v2exTool(function(a) {
  return v2exRequest("GET", "/topics/" + v2exID(a.topic_id, "主题 ID") + "/replies?p=" + v2exPage(a.page), null, true, 4000);
}));

registerTool("my_profile", v2exTool(function() {
  return v2exRequest("GET", "/member", null, true);
}));

registerTool("notifications", v2exTool(function(a) {
  return v2exRequest("GET", "/notifications?p=" + v2exPage(a.page), null, true, 4000);
}));

registerTool("delete_notification", v2exTool(function(a) {
  return v2exRequest("DELETE", "/notifications/" + v2exID(a.notification_id, "提醒 ID"), null, true);
}));

registerTool("create_topic", v2exTool(function(a) {
  var syntax = a.syntax == null ? "markdown" : String(a.syntax);
  if (syntax !== "markdown" && syntax !== "default") throw new Error("内容格式必须是 markdown 或 default");
  return v2exRequest("POST", "/topics", {
    node_name: v2exName(a.node_name, "节点名称"),
    title: v2exText(a.title, "标题", 120, true),
    content: v2exText(a.content, "正文", 20000, false),
    syntax: syntax
  }, true, 20000);
}));

registerTool("create_reply", v2exTool(function(a) {
  return v2exRequest("POST", "/topics/" + v2exID(a.topic_id, "主题 ID") + "/replies", {
    content: v2exText(a.content, "回复", 10000, true)
  }, true, 10000);
}));

registerTool("set_sticky", v2exTool(function(a) {
  var duration = a.duration == null ? "15min" : String(a.duration);
  if (["15min", "1hr", "8hr"].indexOf(duration) < 0) throw new Error("置顶时长无效");
  return v2exRequest("POST", "/topics/" + v2exID(a.topic_id, "主题 ID") + "/set-sticky?duration=" + duration, null, true);
}));

registerTool("boost_topic", v2exTool(function(a) {
  return v2exRequest("POST", "/topics/" + v2exID(a.topic_id, "主题 ID") + "/boost", null, true);
}));
