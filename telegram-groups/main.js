registerTool("read_new_messages", function () {
  var config = JSON.parse(host.config());
  var token = String(config.bot_token || "").trim();
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    return JSON.stringify({error: "请在插件配置中填写有效的 Bot Token"});
  }

  var chatID = String(config.chat_id || "").trim();
  if (chatID && !/^-?\d+$/.test(chatID)) {
    return JSON.stringify({error: "群组 Chat ID 必须是数字"});
  }

  var saved = JSON.parse(host.storage("get", "next-update-id"));
  var offset = typeof saved === "number" && isFinite(saved) && saved >= 0 ? saved : null;
  var body = {limit: 100, timeout: 0, allowed_updates: ["message"]};
  if (offset !== null) body.offset = offset;

  var response;
  try {
    response = JSON.parse(host.request(JSON.stringify({
      method: "POST",
      url: "https://api.telegram.org/bot" + token + "/getUpdates",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body)
    })));
  } catch (error) {
    // Network errors can contain the request URL, including the token.
    return JSON.stringify({error: "Telegram 网络请求失败，请检查连接与域名授权"});
  }

  var payload;
  try {
    payload = JSON.parse(response.body || "{}");
  } catch (error) {
    return JSON.stringify({error: "Telegram 返回了无法解析的数据"});
  }
  if (response.status !== 200 || !payload.ok || !Array.isArray(payload.result)) {
    var code = payload.error_code || response.status;
    var reason = code === 401 ? "Bot Token 无效" :
      code === 409 ? "此 Bot 已设置 webhook，或正在被其他程序读取" :
      "Telegram API 请求失败";
    return JSON.stringify({error: reason, status: code});
  }

  var messages = [];
  var next = offset;
  var updates = payload.result;
  var groups = JSON.parse(host.storage("get", "known-groups"));
  if (!Array.isArray(groups)) groups = [];
  var groupsChanged = false;
  for (var i = 0; i < updates.length; i++) {
    var update = updates[i];
    if (typeof update.update_id !== "number") continue;
    next = update.update_id + 1;
    var message = update.message;
    if (!message || !message.chat ||
        (message.chat.type !== "group" && message.chat.type !== "supergroup")) continue;
    var groupID = String(message.chat.id);
    var groupTitle = String(message.chat.title || groupID).slice(0, 100);
    var existing = groups.filter(function (item) { return item.id === groupID; })[0];
    if (existing) {
      existing.title = groupTitle;
      existing.date = message.date || 0;
    } else {
      groups.push({id: groupID, title: groupTitle, date: message.date || 0});
    }
    groupsChanged = true;
    if (chatID && String(message.chat.id) !== chatID) continue;
    messages.push({
      update_id: update.update_id,
      message_id: message.message_id,
      chat_id: message.chat.id,
      chat_title: message.chat.title || "",
      date: message.date,
      sender: message.from ? (message.from.username || message.from.first_name || "") :
        (message.sender_chat ? message.sender_chat.title || "" : ""),
      text: String(message.text || message.caption || "").slice(0, 4000),
      content_type: message.text ? "text" : message.caption ? "caption" : "other"
    });
    if (messages.length === 30) break;
  }

  if (groupsChanged) {
    groups.sort(function (a, b) { return b.date - a.date; });
    host.storage("put", "known-groups", JSON.stringify(groups.slice(0, 30)));
  }
  if (next !== null && next !== offset) {
    host.storage("put", "next-update-id", JSON.stringify(next));
  }
  return JSON.stringify({messages: messages, count: messages.length,
    has_more: updates.length === 100 || (messages.length === 30 && i < updates.length - 1)});
});

registerCallback("group_selected", function (responseJSON) {
  var response = JSON.parse(responseJSON);
  if (response.cancelled) return JSON.stringify({cancelled: true});
  var selected = response.selections[0].option_ids[0];
  var groups = JSON.parse(host.storage("get", "known-groups"));
  var group = Array.isArray(groups) && groups.filter(function (item) { return item.id === selected; })[0];
  if (!group) {
    var config = JSON.parse(host.config());
    if (String(config.chat_id || "").trim() === selected) {
      group = {id: selected, title: "已配置群组 " + selected};
    }
  }
  if (!group) return JSON.stringify({error: "所选群组已不在列表中，请重新选择"});
  return JSON.stringify({chat_id: group.id, chat_title: group.title});
});

registerTool("choose_group", function () {
  var groups = JSON.parse(host.storage("get", "known-groups"));
  if (!Array.isArray(groups)) groups = [];
  var config = JSON.parse(host.config());
  var configuredID = String(config.chat_id || "").trim();
  if (configuredID && /^-?[0-9]+$/.test(configuredID) &&
      !groups.some(function (item) { return item.id === configuredID; })) {
    groups.unshift({id: configuredID, title: "已配置群组 " + configuredID});
  }
  if (!groups.length) {
    return JSON.stringify({error: "还没有发现群组；请让 Bot 加入群并收到一条消息，然后先调用 read_new_messages"});
  }
  return host.choose(JSON.stringify({
    title: "选择 Telegram 群组",
    tabs: [{id: "groups", title: "群组", mode: "single",
      options: groups.slice(0, 30).map(function (group) {
        return {id: group.id, label: group.title.slice(0, 100), description: group.id};
      })}]
  }));
});

registerTool("send_message", function (raw) {
  var args;
  try { args = JSON.parse(raw || "{}"); } catch (_) {
    return JSON.stringify({ok: false, error: "发送参数不是有效 JSON"});
  }
  if (typeof args.chat_id !== "string" || !/^-[1-9]\d*$/.test(args.chat_id)) {
    return JSON.stringify({ok: false, error: "请提供目标群的负数 Chat ID"});
  }
  if (typeof args.text !== "string" || !args.text.trim() || args.text.length > 4096) {
    return JSON.stringify({ok: false, error: "消息正文须为 1 到 4096 字符"});
  }
  var config = JSON.parse(host.config());
  var token = String(config.bot_token || "").trim();
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    return JSON.stringify({ok: false, error: "请在插件配置中填写有效的 Bot Token"});
  }

  var response;
  try {
    response = JSON.parse(host.request(JSON.stringify({
      method: "POST",
      url: "https://api.telegram.org/bot" + token + "/sendMessage",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({chat_id: args.chat_id, text: args.text})
    })));
  } catch (_) {
    // The server may have accepted the message before the connection failed.
    // Host errors may also contain the token-bearing request URL.
    return JSON.stringify({ok: false, delivery_unknown: true,
      error: "请求结果未知，请先查看群组，勿自动重发"});
  }

  var payload;
  try { payload = JSON.parse(response.body || "{}"); } catch (_) {
    return JSON.stringify({ok: false, delivery_unknown: true,
      error: "Telegram 响应无法解析，请先查看群组"});
  }
  if (response.status !== 200 || !payload.ok || !payload.result) {
    return JSON.stringify({ok: false, status: payload.error_code || response.status,
      error: "Telegram 拒绝发送，请检查群 ID 和机器人的发言权限"});
  }
  return JSON.stringify({ok: true, chat_id: String(payload.result.chat.id),
    message_id: payload.result.message_id, date: payload.result.date});
});
