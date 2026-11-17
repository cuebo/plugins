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
  var body = {limit: 100, timeout: 0, allowed_updates: ["message", "chat_join_request"]};
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
  var receivedRequests = JSON.parse(host.storage("get", "pending-join-requests"));
  if (!Array.isArray(receivedRequests)) receivedRequests = [];
  var newJoinRequests = [];
  var groupsChanged = false;
  var pendingChanged = false;
  for (var i = 0; i < updates.length; i++) {
    var update = updates[i];
    if (typeof update.update_id !== "number") continue;
    next = update.update_id + 1;
    var join = update.chat_join_request;
    if (join && join.chat && join.from &&
        (join.chat.type === "group" || join.chat.type === "supergroup")) {
      var joinChatID = String(join.chat.id);
      var joinUserID = String(join.from.id);
      if (chatID && joinChatID !== chatID) continue;
      var request = {chat_id: joinChatID, chat_title: String(join.chat.title || "").slice(0, 100),
        user_id: joinUserID, username: join.from.username || join.from.first_name || "", date: join.date};
      var prior = receivedRequests.filter(function (item) {
        return item.chat_id === joinChatID && item.user_id === joinUserID;
      })[0];
      if (prior) {
        prior.chat_title = request.chat_title;
        prior.username = request.username;
        prior.date = request.date;
      } else receivedRequests.push(request);
      newJoinRequests.push(request);
      pendingChanged = true;
      continue;
    }
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
      sender_id: message.from ? String(message.from.id) : "",
      sender: message.from ? (message.from.username || message.from.first_name || "") :
        (message.sender_chat ? message.sender_chat.title || "" : ""),
      message_thread_id: message.message_thread_id || null,
      text: String(message.text || message.caption || "").slice(0, 4000),
      content_type: message.text ? "text" : message.caption ? "caption" : "other"
    });
    if (messages.length === 30) break;
  }

  if (groupsChanged) {
    groups.sort(function (a, b) { return b.date - a.date; });
    host.storage("put", "known-groups", JSON.stringify(groups.slice(0, 30)));
  }
  if (pendingChanged) {
    receivedRequests.sort(function (a, b) { return b.date - a.date; });
    host.storage("put", "pending-join-requests", JSON.stringify(receivedRequests.slice(0, 50)));
  }
  if (next !== null && next !== offset) {
    host.storage("put", "next-update-id", JSON.stringify(next));
  }
  var cardShown = telegramSafeCard(function () { return telegramMessagesCard(messages); });
  return JSON.stringify({messages: messages, count: messages.length,
    new_join_requests: newJoinRequests,
    has_more: updates.length === 100 || (messages.length === 30 && i < updates.length - 1),
    card_shown: cardShown});
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
  var parseMode;
  try { parseMode = telegramFormat(args.format); } catch (error) {
    return JSON.stringify({ok: false, error: error.message});
  }
  var config = JSON.parse(host.config());
  var token = String(config.bot_token || "").trim();
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    return JSON.stringify({ok: false, error: "请在插件配置中填写有效的 Bot Token"});
  }

  var response;
  try {
    var sendBody = {chat_id: args.chat_id, text: args.text};
    if (parseMode) sendBody.parse_mode = parseMode;
    response = JSON.parse(host.request(JSON.stringify({
      method: "POST",
      url: "https://api.telegram.org/bot" + token + "/sendMessage",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(sendBody)
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
      error: parseMode && /parse entities/i.test(payload.description || "") ?
        "MarkdownV2 格式无效，请检查转义" : "Telegram 拒绝发送，请检查群 ID 和机器人的发言权限"});
  }
  return JSON.stringify({ok: true, chat_id: String(payload.result.chat.id),
    message_id: payload.result.message_id, date: payload.result.date});
});

function telegramCardText(id, value, style, accent) {
  var item = {text: String(value), style: style};
  if (accent) item.appearance = {accent: accent};
  return {id: id, text: item};
}

function telegramCardIcon(id, symbol, accent) {
  return {id: id, icon: {appearance: {accent: accent, iconSource: {systemName: symbol}}}};
}

function telegramCardBadge(id, value, accent) {
  return {id: id, badge: {text: String(value), appearance: {
    accent: accent, size: "PLUGIN_COMPONENT_SIZE_COMPACT"}}};
}

function telegramCardHeader(id, name, subtitle, badge, symbol, accent) {
  return {id: id + "-head", stack: {axis: "PLUGIN_LAYOUT_AXIS_HORIZONTAL", spacing: 10, children: [
    telegramCardIcon(id + "-icon", symbol, accent),
    {id: id + "-identity", stack: {spacing: 4, children: [
      telegramCardText(id + "-name", name, "PLUGIN_TEXT_STYLE_TITLE"),
      telegramCardText(id + "-sub", subtitle, "PLUGIN_TEXT_STYLE_CAPTION")
    ]}},
    telegramCardBadge(id + "-badge", badge, accent)
  ]}};
}

function telegramCardShow(id, title, children) {
  try {
    var card = {id: "telegram" + Date.now().toString(36) + Math.floor(Math.random() * 1000000).toString(36),
      title: title, components: [{id: id + "-root", card: {
        appearance: {variant: "PLUGIN_COMPONENT_VARIANT_DARK"}, children: children}}]};
    var shown = JSON.parse(host.ui("show", JSON.stringify(card)));
    return shown && shown.ok === true;
  } catch (_) {
    // A display failure must never turn a completed Telegram write into a retryable failure.
    return false;
  }
}

function telegramSafeCard(render) {
  try { return render(); } catch (_) { return false; }
}

function telegramCardShort(value, limit) {
  var content = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  return content.length > limit ? content.slice(0, limit - 1) + "…" : content;
}

function telegramCardTime(seconds) {
  var value = Number(seconds);
  if (!isFinite(value) || value <= 0) return "时间未知";
  var date = new Date(value * 1000);
  if (!isFinite(date.getTime())) return "时间未知";
  var time = (date.getHours() < 10 ? "0" : "") + date.getHours() + ":" +
    (date.getMinutes() < 10 ? "0" : "") + date.getMinutes();
  var today = new Date();
  return date.toDateString() === today.toDateString() ? "今天 " + time :
    (date.getMonth() + 1) + "/" + date.getDate() + " " + time;
}

function telegramMessagesCard(messages) {
  if (!messages.length) return false;
  var id = "tg-new", accent = "PLUGIN_ACCENT_BLUE";
  var firstGroup = String(messages[0].chat_id);
  var oneGroup = messages.every(function (item) { return String(item.chat_id) === firstGroup; });
  var groupTitle = oneGroup ? telegramCardShort(messages[0].chat_title || firstGroup, 40) : "多个群组";
  var recent = messages.slice(-5).reverse();
  var children = [
    telegramCardHeader(id, groupTitle, "Telegram · 本次读取", messages.length + " 条新消息",
      "paperplane.fill", accent),
    telegramCardText(id + "-desc", "只展示 Bot 此次收到的群组更新，不包含更早历史。",
      "PLUGIN_TEXT_STYLE_CAPTION"),
    {id: id + "-list", list: {title: "新消息", appearance: {accent: accent}, items:
      recent.map(function (message) {
        var sender = telegramCardShort(message.sender || "未知发送者", 30);
        var prefix = oneGroup ? "" : telegramCardShort(message.chat_title || message.chat_id, 22) + " · ";
        return {title: prefix + sender + " · " + telegramCardTime(message.date),
          subtitle: telegramCardShort(message.text || "[非文字消息]", 140),
          value: {text: "#" + message.message_id}};
      })}}
  ];
  if (messages.length > recent.length) children.push(telegramCardText(id + "-more",
    "卡片展示最近 " + recent.length + " 条，完整结果共 " + messages.length + " 条。",
    "PLUGIN_TEXT_STYLE_CAPTION"));
  var topic = oneGroup && recent[0].message_thread_id;
  if (topic) children.push(telegramCardBadge(id + "-topic", "话题 #" + topic, accent));
  return telegramCardShow(id, "新消息", children);
}

function telegramGroupCard(info) {
  var id = "tg-group", accent = "PLUGIN_ACCENT_CYAN";
  var type = info.type === "supergroup" ? "超级群" : info.type === "group" ? "群组" :
    (info.type || "类型未知");
  function metric(key, name, value, symbol) {
    return {id: id + "-" + key, card: {appearance: {variant: "PLUGIN_COMPONENT_VARIANT_DARK"},
      children: [{id: id + "-" + key + "-head", stack: {
        axis: "PLUGIN_LAYOUT_AXIS_HORIZONTAL", spacing: 6, children: [
          telegramCardIcon(id + "-" + key + "-icon", symbol, accent),
          telegramCardText(id + "-" + key + "-title", name, "PLUGIN_TEXT_STYLE_CAPTION")
        ]}}, telegramCardText(id + "-" + key + "-value", value,
          "PLUGIN_TEXT_STYLE_DISPLAY", accent)]}};
  }
  var admins = info.administrators || [];
  var children = [
    telegramCardHeader(id, telegramCardShort(info.title || info.chat_id, 42),
      "Telegram · 群组资料", type, "person.2.fill", accent),
    telegramCardText(id + "-description", telegramCardShort(info.description || "暂无群组简介", 220),
      "PLUGIN_TEXT_STYLE_CAPTION"),
    {id: id + "-stats", grid: {columns: 2, spacing: 7, children: [
      metric("members", "成员", info.member_count == null ? "暂不可用" :
        Number(info.member_count).toLocaleString(), "person.3.fill"),
      metric("admins", "管理员", info.warnings.indexOf("无法读取管理员") >= 0 ? "暂不可用" :
        String(admins.length) + (info.admin_count_limited ? "+" : ""),
        "person.crop.circle.badge.checkmark")
    ]}},
    {id: id + "-details", descriptionList: {title: "群组信息", items: [
      {title: "群组 ID", value: {text: info.chat_id}},
      {title: "群组类型", value: {text: type}}
    ]}}
  ];
  if (admins.length) children.push({id: id + "-admin-list", list: {title: "管理员",
    appearance: {accent: accent}, items: admins.slice(0, 4).map(function (admin) {
      return {title: telegramCardShort(admin.username || admin.user_id, 50),
        subtitle: admin.status === "creator" ? "群主" : "管理员",
        value: {text: admin.user_id}};
    })}});
  children.push(telegramCardText(id + "-note",
    info.warnings.length ? info.warnings.join(" · ") : "群组资料来自 Telegram 当前查询结果。",
    "PLUGIN_TEXT_STYLE_CAPTION"));
  return telegramCardShow(id, "群组资料", children);
}

function telegramMemberCard(info) {
  var id = "tg-member", accent = "PLUGIN_ACCENT_CYAN";
  var status = {creator: "群主", administrator: "管理员", member: "成员",
    restricted: "受限成员", left: "已退出", kicked: "已移出"}[info.status] || "状态未知";
  var items = [
    {title: "用户 ID", value: {text: info.user_id}},
    {title: "群组 ID", value: {text: info.chat_id}},
    {title: "身份", value: {text: status}}
  ];
  if (typeof info.can_send_messages === "boolean") items.push({title: "发言权限",
    value: {text: info.can_send_messages ? "允许" : "受限"}});
  if (info.until_date) items.push({title: "限制到期", value: {text: telegramCardTime(info.until_date)}});
  return telegramCardShow(id, "成员状态", [
    telegramCardHeader(id, telegramCardShort(info.username ? "@" + info.username : info.user_id, 40),
      "Telegram · 成员状态", status, "person.crop.circle", accent),
    {id: id + "-details", descriptionList: {title: "查询结果", items: items}},
    telegramCardText(id + "-note", "状态来自 Telegram 当前查询结果。", "PLUGIN_TEXT_STYLE_CAPTION")
  ]);
}

function telegramJoinCard(requests) {
  var id = "tg-join", accent = "PLUGIN_ACCENT_ORANGE";
  var oneGroup = requests.length > 0 && requests.every(function (item) {
    return String(item.chat_id) === String(requests[0].chat_id);
  });
  var group = oneGroup ? telegramCardShort(requests[0].chat_title || requests[0].chat_id, 35) :
    "所有群组";
  var children = [telegramCardHeader(id, "入群申请记录", group + " · 已收到",
    requests.length + " 条记录", "person.crop.circle.badge.questionmark", accent)];
  if (requests.length) children.push({id: id + "-list", list: {title: "申请者",
    appearance: {accent: accent}, items: requests.slice(0, 5).map(function (request) {
      return {title: telegramCardShort(request.username ? "@" + request.username : request.user_id, 40),
        subtitle: telegramCardTime(request.date) + " · 申请加入 " +
          telegramCardShort(request.chat_title || request.chat_id, 32)};
    })}});
  else children.push(telegramCardText(id + "-empty", "还没有收到入群申请记录。",
    "PLUGIN_TEXT_STYLE_CAPTION"));
  if (requests.length > 5) children.push(telegramCardText(id + "-more",
    "卡片展示最近 5 条，保存记录共 " + requests.length + " 条。", "PLUGIN_TEXT_STYLE_CAPTION"));
  children.push(telegramCardText(id + "-note", "这是 Bot 已收到的记录，无法核实申请目前是否仍待处理。",
    "PLUGIN_TEXT_STYLE_CAPTION"));
  return telegramCardShow(id, "入群申请记录", children);
}

function telegramGroupID(value) {
  if (typeof value !== "string" || !/^-[1-9]\d*$/.test(value)) throw new Error("群组 Chat ID 无效");
  return value;
}

function telegramPositiveID(value, label) {
  if (typeof value === "string" && !/^[1-9]\d*$/.test(value)) throw new Error(label + " 无效");
  var id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error(label + " 无效");
  return id;
}

function telegramText(value, label, limit) {
  if (typeof value !== "string" || !value.trim() || value.length > limit) {
    throw new Error(label + " 须为 1 到 " + limit + " 字符");
  }
  return value;
}

function telegramFormat(value) {
  if (value == null || value === "" || value === "plain") return null;
  if (value === "MarkdownV2") return "MarkdownV2";
  throw new Error("格式只支持 plain 或 Telegram MarkdownV2");
}

function telegramRun(raw, fn) {
  try {
    var args = JSON.parse(raw || "{}");
    if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("参数无效");
    return JSON.stringify(fn(args));
  } catch (error) {
    return JSON.stringify({ok: false, error: error.message || "参数无效"});
  }
}

function telegramAPI(method, body, write) {
  var token = String(JSON.parse(host.config()).bot_token || "").trim();
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) return {ok: false, error: "请配置有效的 Bot Token"};
  var response;
  try {
    response = JSON.parse(host.request(JSON.stringify({method: "POST",
      url: "https://api.telegram.org/bot" + token + "/" + method,
      headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)})));
  } catch (_) {
    return {ok: false, delivery_unknown: !!write,
      error: write ? "请求结果未知，请先到群里核对，勿自动重试" : "Telegram 网络请求失败"};
  }
  var payload;
  try { payload = JSON.parse(response.body || "{}"); } catch (_) {
    return {ok: false, delivery_unknown: !!write, error: "Telegram 响应无法解析"};
  }
  if (response.status !== 200 || !payload.ok) {
    return {ok: false, status: payload.error_code || response.status,
      error: body.parse_mode && /parse entities/i.test(payload.description || "") ?
        "MarkdownV2 格式无效，请检查转义" : "Telegram 拒绝操作，请检查目标和机器人权限"};
  }
  return {ok: true, data: payload.result};
}

function telegramSentMessage(result) {
  if (!result.ok) return result;
  var message = result.data || {};
  return {ok: true, chat_id: message.chat ? String(message.chat.id) : "",
    message_id: message.message_id, date: message.date};
}

registerTool("get_group_info", function (raw) { return telegramRun(raw, function (args) {
  var chatID = telegramGroupID(args.chat_id);
  var chat = telegramAPI("getChat", {chat_id: chatID});
  if (!chat.ok) return chat;
  var count = telegramAPI("getChatMemberCount", {chat_id: chatID});
  var admins = telegramAPI("getChatAdministrators", {chat_id: chatID});
  var info = chat.data || {};
  var group = {ok: true, chat_id: chatID, title: info.title || "", type: info.type || "",
    description: String(info.description || "").slice(0, 1000),
    member_count: count.ok ? count.data : null,
    administrators: admins.ok && Array.isArray(admins.data) ? admins.data.slice(0, 30).map(function (item) {
      return {user_id: item.user ? String(item.user.id) : "", username: item.user ?
        (item.user.username || item.user.first_name || "") : "", status: item.status};
    }) : [], admin_count_limited: admins.ok && Array.isArray(admins.data) && admins.data.length > 30,
    warnings: [!count.ok ? "无法读取成员数" : null, !admins.ok ? "无法读取管理员" : null].filter(Boolean)};
  group.card_shown = telegramSafeCard(function () { return telegramGroupCard(group); });
  return group;
}); });

registerTool("get_member_status", function (raw) { return telegramRun(raw, function (args) {
  var chatID = telegramGroupID(args.chat_id), userID = telegramPositiveID(args.user_id, "用户 ID");
  var result = telegramAPI("getChatMember", {chat_id: chatID, user_id: userID});
  if (!result.ok) return result;
  var member = result.data || {};
  var info = {ok: true, chat_id: chatID, user_id: String(userID), status: member.status,
    username: member.user ? (member.user.username || member.user.first_name || "") : "",
    until_date: member.until_date || null, can_send_messages: member.can_send_messages};
  info.card_shown = telegramSafeCard(function () { return telegramMemberCard(info); });
  return info;
}); });

registerTool("list_join_requests", function () {
  var requests = JSON.parse(host.storage("get", "pending-join-requests"));
  if (!Array.isArray(requests)) requests = [];
  requests = requests.slice().sort(function (a, b) { return Number(b.date || 0) - Number(a.date || 0); }).slice(0, 50);
  return JSON.stringify({ok: true, requests: requests, current_status_unknown: true,
    card_shown: telegramSafeCard(function () { return telegramJoinCard(requests); })});
});

registerTool("reply_message", function (raw) { return telegramRun(raw, function (args) {
  var body = {chat_id: telegramGroupID(args.chat_id),
    reply_parameters: {message_id: telegramPositiveID(args.message_id, "消息 ID")},
    text: telegramText(args.text, "回复正文", 4096)};
  var parseMode = telegramFormat(args.format);
  if (parseMode) body.parse_mode = parseMode;
  if (args.message_thread_id != null) body.message_thread_id = telegramPositiveID(args.message_thread_id, "话题 ID");
  return telegramSentMessage(telegramAPI("sendMessage", body, true));
}); });

registerTool("send_poll", function (raw) { return telegramRun(raw, function (args) {
  var options = telegramText(args.options, "投票选项", 1500).split(/\r?\n/).map(function (item) { return item.trim(); });
  if (options.length < 2 || options.length > 12 || options.some(function (item) { return !item || item.length > 100; })) {
    throw new Error("投票需要 2 至 12 个选项，每项最多 100 字符");
  }
  var body = {chat_id: telegramGroupID(args.chat_id),
    question: telegramText(args.question, "投票问题", 300),
    options: options.map(function (item) { return {text: item}; }),
    is_anonymous: args.is_anonymous !== false,
    allows_multiple_answers: args.allows_multiple_answers === true};
  if (args.message_thread_id != null) body.message_thread_id = telegramPositiveID(args.message_thread_id, "话题 ID");
  var result = telegramAPI("sendPoll", body, true);
  if (!result.ok) return result;
  return {ok: true, chat_id: body.chat_id, message_id: result.data.message_id,
    poll_id: result.data.poll ? result.data.poll.id : ""};
}); });

function telegramMessageAction(raw, method) { return telegramRun(raw, function (args) {
  var body = {chat_id: telegramGroupID(args.chat_id), message_id: telegramPositiveID(args.message_id, "消息 ID")};
  var result = telegramAPI(method, body, true);
  return result.ok ? {ok: true, action: method, chat_id: body.chat_id, message_id: body.message_id} : result;
}); }
registerTool("pin_message", function (raw) { return telegramMessageAction(raw, "pinChatMessage"); });
registerTool("unpin_message", function (raw) { return telegramMessageAction(raw, "unpinChatMessage"); });
registerTool("delete_message", function (raw) { return telegramMessageAction(raw, "deleteMessage"); });

function telegramMemberAction(raw, method, extra) { return telegramRun(raw, function (args) {
  var body = {chat_id: telegramGroupID(args.chat_id), user_id: telegramPositiveID(args.user_id, "用户 ID")};
  if (extra) extra(body, args);
  var result = telegramAPI(method, body, true);
  return result.ok ? {ok: true, action: method, chat_id: body.chat_id, user_id: String(body.user_id)} : result;
}); }
registerTool("restrict_member", function (raw) { return telegramMemberAction(raw, "restrictChatMember", function (body, args) {
  body.permissions = {can_send_messages: false};
  if (args.until_date != null) body.until_date = telegramPositiveID(args.until_date, "解除时间");
}); });
registerTool("unrestrict_member", function (raw) { return telegramMemberAction(raw, "restrictChatMember", function (body) {
  body.permissions = {can_send_messages: true, can_send_audios: true, can_send_documents: true,
    can_send_photos: true, can_send_videos: true, can_send_video_notes: true,
    can_send_voice_notes: true, can_send_polls: true, can_send_other_messages: true,
    can_add_web_page_previews: true};
}); });
registerTool("ban_member", function (raw) { return telegramMemberAction(raw, "banChatMember"); });
registerTool("unban_member", function (raw) { return telegramMemberAction(raw, "unbanChatMember", function (body) {
  body.only_if_banned = true;
}); });

function telegramJoinAction(raw, method) { return telegramRun(raw, function (args) {
  var chatID = telegramGroupID(args.chat_id), userID = telegramPositiveID(args.user_id, "用户 ID");
  var pending = JSON.parse(host.storage("get", "pending-join-requests"));
  if (!Array.isArray(pending) || !pending.some(function (item) {
    return item.chat_id === chatID && item.user_id === String(userID);
  })) return {ok: false, error: "插件尚未收到这位用户的入群申请"};
  var result = telegramAPI(method, {chat_id: chatID, user_id: userID}, true);
  if (!result.ok) return result;
  var remaining = pending.filter(function (item) { return item.chat_id !== chatID || item.user_id !== String(userID); });
  var cacheUpdated = true;
  try { host.storage("put", "pending-join-requests", JSON.stringify(remaining)); } catch (_) { cacheUpdated = false; }
  return {ok: true, action: method, chat_id: chatID, user_id: String(userID), cache_updated: cacheUpdated};
}); }
registerTool("approve_join_request", function (raw) { return telegramJoinAction(raw, "approveChatJoinRequest"); });
registerTool("decline_join_request", function (raw) { return telegramJoinAction(raw, "declineChatJoinRequest"); });
