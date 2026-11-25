var NOTION_API = "https://api.notion.com/v1";
var NOTION_VERSION = "2026-03-11";

function notionText(zh, en) {
  return /^en(?:-|$)/i.test(host.language ? host.language() : "zh-Hans") ? en : zh;
}

function notionError(message, status) {
  return {ok:false, status:status || 0, error:String(message || notionText("Notion 请求失败", "Notion request failed")).slice(0, 240)};
}

function notionConfig() {
  var config = JSON.parse(host.config() || "{}");
  return {token:typeof config.token === "string" ? config.token.trim() : ""};
}

function notionRequest(method, path, payload) {
  var config = notionConfig();
  var request = {method:method, url:NOTION_API + path,
    headers:{"Accept":"application/json", "Notion-Version":NOTION_VERSION}};
  if (payload !== undefined) {
    request.headers["Content-Type"] = "application/json";
    request.body = JSON.stringify(payload);
  }
  var response;
  try {
    request.auth = "oauth";
    response = JSON.parse(host.request(JSON.stringify(request)));
  } catch (error) {
    if (String(error).indexOf("请先连接插件账号") < 0 || !config.token) {
      return notionError(notionText("请先连接 Notion，或检查授权与网络权限", "Connect Notion or check authorization and network access"));
    }
    delete request.auth;
    request.headers.Authorization = "Bearer " + config.token;
    try { response = JSON.parse(host.request(JSON.stringify(request))); }
    catch (_) { return notionError(notionText("Notion 请求失败", "Notion request failed")); }
  }
  var data;
  try { data = JSON.parse(response.body || "{}"); }
  catch (_) { return notionError(notionText("Notion 返回了无效数据", "Notion returned invalid data"), response.status); }
  if (response.status < 200 || response.status >= 300) {
    var message = response.status === 401 ? notionText("Notion 授权已失效，请重新连接", "Notion authorization expired; reconnect") :
      response.status === 403 || response.status === 404 ? notionText("无法访问该内容；请确认已在 Notion 授权此页面或具备相应权限", "Content unavailable; check page access and permissions") :
      response.status === 429 ? notionText("Notion 请求过于频繁，请稍后再试", "Notion rate limit reached; retry later") :
      typeof data.message === "string" ? data.message : notionText("Notion 请求失败", "Notion request failed");
    return notionError(message, response.status);
  }
  return {ok:true, data:data};
}

function notionID(value) {
  if (typeof value !== "string" || !/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(value)) {
    throw new Error(notionText("Notion ID 无效", "Invalid Notion ID"));
  }
  return value.toLowerCase();
}

function notionCursor(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || value.length > 300 || /[\s?#]/.test(value)) throw new Error(notionText("分页游标无效", "Invalid page cursor"));
  return value;
}

function notionRichText(items) {
  if (!Array.isArray(items)) return "";
  return items.map(function(item) { return item && (item.plain_text || item.text && item.text.content) || ""; }).join("").slice(0, 8000);
}

function notionTitle(value) {
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value.title)) return notionRichText(value.title);
  if (value.properties) {
    for (var key in value.properties) {
      var prop = value.properties[key];
      if (prop && prop.type === "title") return notionRichText(prop.title);
    }
  }
  return value.name || value.id || "";
}

function notionProperty(prop) {
  if (!prop || !prop.type) return null;
  switch (prop.type) {
  case "title": return notionRichText(prop.title);
  case "rich_text": return notionRichText(prop.rich_text);
  case "number": return prop.number;
  case "checkbox": return prop.checkbox === true;
  case "select": return prop.select && prop.select.name || null;
  case "status": return prop.status && prop.status.name || null;
  case "multi_select": return (prop.multi_select || []).map(function(x) { return x.name; });
  case "date": return prop.date && {start:prop.date.start, end:prop.date.end || null} || null;
  case "url": return prop.url;
  case "email": return prop.email;
  case "phone_number": return prop.phone_number;
  case "people": return (prop.people || []).map(function(x) { return x.name || x.id; });
  default: return null;
  }
}

function notionProperties(properties) {
  var result = {}, count = 0;
  for (var key in properties || {}) {
    if (count >= 20) break;
    var value = notionProperty(properties[key]);
    if (value !== null && value !== "") { result[key] = value; count++; }
  }
  return result;
}

function notionCompactItem(item) {
  return {id:item.id, object:item.object, title:notionTitle(item), url:item.url || null,
    last_edited_time:item.last_edited_time || null,
    parent:item.parent || null,
    properties:item.object === "page" ? notionProperties(item.properties) : undefined};
}

function notionCompactBlock(block) {
  var value = block[block.type] || {};
  var result = {id:block.id, type:block.type, has_children:block.has_children === true};
  if (value.rich_text) result.text = notionRichText(value.rich_text);
  if (block.type === "child_page" || block.type === "child_database") result.title = value.title || "";
  if (block.type === "to_do") result.checked = value.checked === true;
  if (block.type === "image" || block.type === "file" || block.type === "pdf") {
    result.caption = notionRichText(value.caption);
    result.url = value.external && value.external.url || value.file && value.file.url || null;
  }
  if (block.type === "bookmark" || block.type === "embed") result.url = value.url || null;
  return result;
}

function notionBlocks(id, cursor) {
  var path = "/blocks/" + notionID(id) + "/children?page_size=30";
  var next = notionCursor(cursor);
  if (next) path += "&start_cursor=" + encodeURIComponent(next);
  var response = notionRequest("GET", path);
  if (!response.ok) return response;
  return {ok:true, block_id:id, blocks:(response.data.results || []).map(notionCompactBlock),
    has_more:response.data.has_more === true, next_cursor:response.data.next_cursor || null};
}

function notionContent(value, label, max) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(label + notionText("不能为空或过长", " is empty or too long"));
  }
  return value.trim();
}

function notionInputRichText(text) {
  var parts = [];
  for (var i = 0; i < text.length; i += 1800) {
    parts.push({type:"text", text:{content:text.slice(i, i + 1800)}});
  }
  return parts;
}

function notionTool(fn) {
  return function(raw) {
    try { return JSON.stringify(fn(JSON.parse(raw || "{}"))); }
    catch (error) { return JSON.stringify(notionError(error && error.message)); }
  };
}

registerTool("search", notionTool(function(a) {
  var body = {page_size:30, sort:{direction:"descending", timestamp:"last_edited_time"}};
  if (a.query != null && a.query !== "") body.query = notionContent(a.query, notionText("标题关键词", "Title query"), 100);
  var cursor = notionCursor(a.cursor);
  if (cursor) body.start_cursor = cursor;
  var response = notionRequest("POST", "/search", body);
  if (!response.ok) return response;
  return {ok:true, search_scope:"title_only", items:(response.data.results || []).map(notionCompactItem),
    has_more:response.data.has_more === true, next_cursor:response.data.next_cursor || null};
}));

registerTool("read_page", notionTool(function(a) {
  var id = notionID(a.page_id);
  var page = notionRequest("GET", "/pages/" + id);
  if (!page.ok) return page;
  var content = notionBlocks(id, a.cursor);
  if (!content.ok) return content;
  return {ok:true, page:notionCompactItem(page.data), blocks:content.blocks,
    has_more:content.has_more, next_cursor:content.next_cursor};
}));

registerTool("list_block_children", notionTool(function(a) {
  return notionBlocks(a.block_id, a.cursor);
}));

registerTool("query_data_source", notionTool(function(a) {
  var id = notionID(a.data_source_id);
  var body = {page_size:30};
  var cursor = notionCursor(a.cursor);
  if (cursor) body.start_cursor = cursor;
  var response = notionRequest("POST", "/data_sources/" + id + "/query", body);
  if (!response.ok) return response;
  return {ok:true, data_source_id:id, entries:(response.data.results || []).map(notionCompactItem),
    has_more:response.data.has_more === true, next_cursor:response.data.next_cursor || null};
}));

registerTool("create_page", notionTool(function(a) {
  var parentID = notionID(a.parent_page_id);
  var title = notionContent(a.title, notionText("标题", "Title"), 100);
  var body = {parent:{type:"page_id", page_id:parentID},
    properties:{title:{type:"title", title:notionInputRichText(title)}}};
  if (a.text != null && a.text !== "") {
    var text = notionContent(a.text, notionText("正文", "Body"), 8000);
    body.children = [{object:"block", type:"paragraph", paragraph:{rich_text:notionInputRichText(text)}}];
  }
  var response = notionRequest("POST", "/pages", body);
  if (!response.ok) return response;
  return {ok:true, accepted:true, page:notionCompactItem(response.data)};
}));

registerTool("append_page_text", notionTool(function(a) {
  var id = notionID(a.page_id);
  var text = notionContent(a.text, notionText("正文", "Text"), 8000);
  var response = notionRequest("PATCH", "/blocks/" + id + "/children",
    {children:[{object:"block", type:"paragraph", paragraph:{rich_text:notionInputRichText(text)}}]});
  if (!response.ok) return response;
  return {ok:true, accepted:true, page_id:id,
    appended_block_ids:(response.data.results || []).map(function(x) { return x.id; })};
}));
