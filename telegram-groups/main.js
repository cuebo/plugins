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
  var pending = JSON.parse(host.storage("get", "pending-join-requests"));
  if (!Array.isArray(pending)) pending = [];
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
      if (!pending.some(function (item) { return item.chat_id === joinChatID && item.user_id === joinUserID; })) {
        var request = {chat_id: joinChatID, chat_title: String(join.chat.title || "").slice(0, 100),
          user_id: joinUserID, username: join.from.username || join.from.first_name || "", date: join.date};
        pending.push(request);
        newJoinRequests.push(request);
        pendingChanged = true;
      }
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
    pending.sort(function (a, b) { return b.date - a.date; });
    host.storage("put", "pending-join-requests", JSON.stringify(pending.slice(0, 50)));
  }
  if (next !== null && next !== offset) {
    host.storage("put", "next-update-id", JSON.stringify(next));
  }
  return JSON.stringify({messages: messages, count: messages.length,
    new_join_requests: newJoinRequests,
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
  var chat = telegramAPI("getChat", {chat_id: chatID}, false);
  if (!chat.ok) return chat;
  var count = telegramAPI("getChatMemberCount", {chat_id: chatID}, false);
  var admins = telegramAPI("getChatAdministrators", {chat_id: chatID}, false);
  var info = chat.data || {};
  return {ok: true, chat_id: chatID, title: info.title || "", type: info.type || "",
    description: String(info.description || "").slice(0, 1000),
    member_count: count.ok ? count.data : null,
    administrators: admins.ok && Array.isArray(admins.data) ? admins.data.slice(0, 30).map(function (item) {
      return {user_id: item.user ? String(item.user.id) : "", username: item.user ?
        (item.user.username || item.user.first_name || "") : "", status: item.status};
    }) : [], admin_count_limited: admins.ok && Array.isArray(admins.data) && admins.data.length > 30,
    warnings: [!count.ok ? "无法读取成员数" : null, !admins.ok ? "无法读取管理员" : null].filter(Boolean)};
}); });

registerTool("get_member_status", function (raw) { return telegramRun(raw, function (args) {
  var chatID = telegramGroupID(args.chat_id), userID = telegramPositiveID(args.user_id, "用户 ID");
  var result = telegramAPI("getChatMember", {chat_id: chatID, user_id: userID}, false);
  if (!result.ok) return result;
  var member = result.data || {};
  return {ok: true, chat_id: chatID, user_id: String(userID), status: member.status,
    username: member.user ? (member.user.username || member.user.first_name || "") : "",
    until_date: member.until_date || null, can_send_messages: member.can_send_messages};
}); });

registerTool("list_join_requests", function () {
  var pending = JSON.parse(host.storage("get", "pending-join-requests"));
  if (!Array.isArray(pending)) pending = [];
  return JSON.stringify({ok: true, requests: pending.slice(0, 50)});
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
