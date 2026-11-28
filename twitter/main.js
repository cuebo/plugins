var FX_BASE = "https://api.fxtwitter.com/2";
var X_BASE = "https://api.x.com/2";

function input(raw) {
  var value = JSON.parse(raw || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("参数必须是对象");
  return value;
}
function text(value, label, max, required) {
  if (value == null && !required) return "";
  if (typeof value !== "string") throw new Error(label + "必须是文本");
  var result = value.trim();
  if (required && !result) throw new Error(label + "不能为空");
  if (result.length > max) throw new Error(label + "不能超过 " + max + " 字符");
  return result;
}
function postID(value) {
  var candidate = String(value == null ? "" : value).trim();
  var match = candidate.match(/^https?:\/\/(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/(\d{2,20})(?:[/?#].*)?$/i);
  if (match) candidate = match[1];
  if (!/^\d{2,20}$/.test(candidate)) throw new Error("帖子 ID 或 X 链接无效");
  return candidate;
}
function userName(value) {
  var name = text(value, "用户名", 16, true).replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(name)) throw new Error("用户名无效");
  return name;
}
function count(value, max, fallback) {
  if (value == null) return fallback;
  var n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error("数量须为 1 至 " + max);
  return n;
}
function config() {
  var data = JSON.parse(host.config() || "{}");
  return data && typeof data === "object" ? data : {};
}
function token(field) {
  var value = config()[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(field === "user_token" ? "请在插件设置填写 X OAuth 2.0 用户访问令牌" : "请在插件设置填写 X App Bearer Token 或用户访问令牌");
  }
  return value.trim();
}
function prune(value, depth) {
  if (depth > 6) return null;
  if (typeof value === "string") return value.length > 5000 ? value.slice(0, 5000) + "…" : value;
  if (Array.isArray(value)) return value.slice(0, 30).map(function(item) { return prune(item, depth + 1); });
  if (value && typeof value === "object") {
    var out = {};
    Object.keys(value).slice(0, 50).forEach(function(key) { out[key] = prune(value[key], depth + 1); });
    return out;
  }
  return value;
}
function request(base, method, path, body, auth) {
  var headers = {Accept: "application/json"};
  var secret = "";
  if (auth === "user") secret = token("user_token");
  if (auth === "app") {
    var cfg = config();
    secret = typeof cfg.app_bearer_token === "string" && cfg.app_bearer_token.trim() ? cfg.app_bearer_token.trim() : token("user_token");
  }
  if (secret) headers.Authorization = "Bearer " + secret;
  if (body != null) headers["Content-Type"] = "application/json";
  var req = {method: method, url: base + path, headers: headers};
  if (body != null) req.body = JSON.stringify(body);
  var response;
  try { response = JSON.parse(host.request(JSON.stringify(req))); }
  catch (error) {
    var message = String(error && error.message || error);
    if (secret) message = message.split(secret).join("[redacted]");
    return {ok: false, error: "网络请求失败或域名未授权：" + message.slice(0, 180)};
  }
  var data = null;
  if (response.body) {
    try { data = JSON.parse(response.body); }
    catch (_) { return {ok: false, status: response.status, error: "接口返回了无法解析的数据"}; }
  }
  var failed = response.status < 200 || response.status >= 300 || (base === FX_BASE && data && typeof data.code === "number" && data.code >= 400);
  if (failed) {
    var message = data && (data.detail || data.title || data.message || data.error) || "接口请求失败";
    if (typeof message !== "string") message = "接口请求失败";
    if (response.status === 401) message = "X 令牌无效或已过期，请在插件设置更新";
    if (response.status === 402) message = "X API 额度不足，请检查开发者控制台余额";
    if (response.status === 429) message = "接口请求过于频繁，请稍后重试";
    if (secret) message = message.split(secret).join("[redacted]");
    return {ok: false, source: base === FX_BASE ? "FxEmbed" : "X API", status: response.status, error: message.slice(0, 240)};
  }
  return {ok: true, source: base === FX_BASE ? "FxEmbed" : "X API", status: response.status, data: prune(data, 0)};
}
function publicGet(path) { return request(FX_BASE, "GET", path, null, ""); }
function xGet(path, auth) { return request(X_BASE, "GET", path, null, auth); }
function xWrite(method, path, body) { return request(X_BASE, method, path, body, "user"); }
function person(value) {
  if (!value || typeof value !== "object") return null;
  return {id: value.id, username: value.screen_name || value.username, name: value.name,
    description: value.description, followers: value.followers, following: value.following,
    avatar_url: value.avatar_url, url: value.url};
}
function post(value) {
  if (!value || typeof value !== "object") return null;
  return {id: value.id, url: value.url || (value.id ? "https://x.com/i/status/" + value.id : undefined),
    text: value.text || value.raw_text, created_at: value.created_at, author: person(value.author),
    replies: value.replies, reposts: value.reposts, likes: value.likes, views: value.views,
    media: prune(value.media, 0), replying_to: value.replying_to};
}
function publicResult(result, data) {
  if (!result.ok) return result;
  result.data = data;
  return result;
}
function tool(fn) {
  return function(raw) {
    try { return JSON.stringify(fn(input(raw))); }
    catch (error) { return JSON.stringify({ok: false, error: String(error && error.message || error)}); }
  };
}
function myID() {
  var me = xGet("/users/me?user.fields=username,name", "user");
  if (!me.ok) return me;
  if (!me.data || !me.data.data || !/^\d+$/.test(String(me.data.data.id || ""))) return {ok: false, error: "X 未返回当前账号 ID"};
  return {ok: true, id: String(me.data.data.id), user: me.data.data};
}
function mine(fn) {
  var me = myID();
  return me.ok ? fn(me.id, me.user) : me;
}

registerTool("get_post", tool(function(a) {
  var result = publicGet("/status/" + postID(a.post_id));
  return publicResult(result, result.ok ? post(result.data.status) : null);
}));
registerTool("get_thread", tool(function(a) {
  var result = publicGet("/thread/" + postID(a.post_id));
  return publicResult(result, result.ok ? {root: post(result.data.status), posts: (result.data.thread || []).slice(0, 30).map(post)} : null);
}));
registerTool("get_profile", tool(function(a) {
  var result = publicGet("/profile/" + userName(a.username));
  return publicResult(result, result.ok ? person(result.data.user) : null);
}));
registerTool("user_timeline", tool(function(a) {
  var n = count(a.count, 30, 10);
  var path = "/profile/" + userName(a.username) + "/statuses?count=" + n;
  if (a.cursor != null) path += "&cursor=" + encodeURIComponent(text(a.cursor, "游标", 500, true));
  var result = publicGet(path);
  return publicResult(result, result.ok ? {posts: (result.data.results || []).slice(0, n).map(post), next_cursor: result.data.cursor && result.data.cursor.bottom} : null);
}));
registerTool("trends", tool(function(a) {
  var n = count(a.count, 30, 10);
  var result = publicGet("/trends?count=" + n);
  return publicResult(result, result.ok ? (result.data.trends || []).slice(0, n).map(function(item) {
    return {name: item.name, rank: item.rank, context: item.context};
  }) : null);
}));
registerTool("search_posts", tool(function(a) {
  var q = text(a.query, "搜索词", 512, true);
  var n = count(a.count, 25, 10);
  if (n < 10) throw new Error("X 官方搜索每页数量须为 10 至 25");
  var path = "/tweets/search/recent?query=" + encodeURIComponent(q) + "&max_results=" + n +
    "&tweet.fields=created_at,author_id,public_metrics,conversation_id&expansions=author_id&user.fields=username,name";
  if (a.next_token != null) path += "&next_token=" + encodeURIComponent(text(a.next_token, "分页令牌", 500, true));
  return xGet(path, "app");
}));
registerTool("my_profile", tool(function() {
  return xGet("/users/me?user.fields=username,name,description,public_metrics,profile_image_url", "user");
}));
registerTool("my_bookmarks", tool(function(a) {
  var n = count(a.count, 25, 10);
  return mine(function(id) {
    var path = "/users/" + id + "/bookmarks?max_results=" + n + "&tweet.fields=created_at,author_id,public_metrics";
    if (a.next_token != null) path += "&pagination_token=" + encodeURIComponent(text(a.next_token, "分页令牌", 500, true));
    return xGet(path, "user");
  });
}));
registerTool("create_post", tool(function(a) {
  var body = {text: text(a.text, "帖子正文", 10000, true)};
  if (a.reply_to_id != null) body.reply = {in_reply_to_tweet_id: postID(a.reply_to_id)};
  return xWrite("POST", "/tweets", body);
}));
registerTool("delete_post", tool(function(a) { return xWrite("DELETE", "/tweets/" + postID(a.post_id), null); }));
registerTool("like_post", tool(function(a) {
  var id = postID(a.post_id);
  return mine(function(me) { return xWrite("POST", "/users/" + me + "/likes", {tweet_id: id}); });
}));
registerTool("unlike_post", tool(function(a) {
  var id = postID(a.post_id);
  return mine(function(me) { return xWrite("DELETE", "/users/" + me + "/likes/" + id, null); });
}));
registerTool("bookmark_post", tool(function(a) {
  var id = postID(a.post_id);
  return mine(function(me) { return xWrite("POST", "/users/" + me + "/bookmarks", {tweet_id: id}); });
}));
registerTool("remove_bookmark", tool(function(a) {
  var id = postID(a.post_id);
  return mine(function(me) { return xWrite("DELETE", "/users/" + me + "/bookmarks/" + id, null); });
}));
registerTool("repost_post", tool(function(a) {
  var id = postID(a.post_id);
  return mine(function(me) { return xWrite("POST", "/users/" + me + "/retweets", {tweet_id: id}); });
}));
registerTool("undo_repost", tool(function(a) {
  var id = postID(a.post_id);
  return mine(function(me) { return xWrite("DELETE", "/users/" + me + "/retweets/" + id, null); });
}));
