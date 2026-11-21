var CF_API = "https://api.cloudflare.com/client/v4";
var CF_TOKEN_URL = "https://dash.cloudflare.com/profile/api-tokens";
var CF_TYPES = ["A", "AAAA", "CNAME", "TXT", "MX"];

function cfText(zh, en) {
  return /^en(?:-|$)/i.test(host.language ? host.language() : "zh-Hans") ? en : zh;
}

function cfError(message, status) {
  return {ok:false, status:status || 0, error:String(message || cfText("Cloudflare 请求失败", "Cloudflare request failed")).slice(0, 200)};
}

function cfConfig() {
  var config = JSON.parse(host.config() || "{}");
  return {token:typeof config.token === "string" ? config.token.trim() : "",
    account_id:typeof config.account_id === "string" ? config.account_id.trim() : ""};
}

function cfSafeMessage(value, token) {
  var message = String(value || "").slice(0, 300);
  if (token) message = message.split(token).join("[redacted]");
  return message.slice(0, 180);
}

function cfRequest(method, path, payload) {
  var config = cfConfig();
  if (!config.token) return cfError(cfText("请先配置 Cloudflare API Token", "Configure a Cloudflare API Token first"));
  var request = {method:method, url:CF_API + path,
    headers:{"Accept":"application/json", "Authorization":"Bearer " + config.token}};
  if (payload !== undefined) {
    request.headers["Content-Type"] = "application/json";
    request.body = JSON.stringify(payload);
  }
  var response;
  try { response = JSON.parse(host.request(JSON.stringify(request))); }
  catch (error) { return cfError(cfSafeMessage(error && error.message, config.token) || cfText("网络或授权失败", "Network or authorization failed")); }
  var body;
  try { body = JSON.parse(response.body || "{}"); }
  catch (_) { return cfError(cfText("Cloudflare 返回了无效数据", "Cloudflare returned invalid data"), response.status); }
  if (response.status < 200 || response.status >= 300 || body.success !== true || body.errors && body.errors.length) {
    var first = body.errors && body.errors[0];
    var detail = first && first.message || body.message || cfText("Cloudflare 请求失败", "Cloudflare request failed");
    return cfError(cfSafeMessage(detail, config.token), response.status);
  }
  return {ok:true, status:response.status, data:body.result, info:body.result_info || {}};
}

function cfGraphQL(zoneID) {
  var config = cfConfig();
  if (!config.token) return cfError(cfText("请先配置 Cloudflare API Token", "Configure a Cloudflare API Token first"));
  var end = new Date();
  var start = new Date(end.getTime() - 24 * 3600000);
  var query = "query($zoneTag: string!, $start: Time!, $end: Time!) { viewer { zones(filter: {zoneTag: $zoneTag}) { httpRequestsAdaptiveGroups(limit: 100, filter: {datetime_geq: $start, datetime_lt: $end, requestSource: \"eyeball\"}, orderBy: [datetimeHour_ASC]) { dimensions { datetimeHour } count sum { edgeResponseBytes } } } } }";
  var request = {method:"POST",url:CF_API + "/graphql",headers:{"Accept":"application/json",
    "Authorization":"Bearer " + config.token,"Content-Type":"application/json"},
    body:JSON.stringify({query:query,variables:{zoneTag:zoneID,start:start.toISOString(),end:end.toISOString()}})};
  var response, body;
  try { response = JSON.parse(host.request(JSON.stringify(request))); }
  catch (error) { return cfError(cfSafeMessage(error && error.message, config.token)); }
  try { body = JSON.parse(response.body || "{}"); }
  catch (_) { return cfError(cfText("流量数据无效", "Invalid traffic response"), response.status); }
  if (response.status < 200 || response.status >= 300 || body.errors && body.errors.length) {
    return cfError(cfSafeMessage(body.errors && body.errors[0] && body.errors[0].message ||
      cfText("流量查询失败或缺少 Analytics Read 权限", "Traffic unavailable or Analytics Read permission missing"), config.token), response.status);
  }
  var zones = body.data && body.data.viewer && body.data.viewer.zones;
  if (!Array.isArray(zones) || !zones[0] || !Array.isArray(zones[0].httpRequestsAdaptiveGroups)) {
    return cfError(cfText("当前域名没有可用的流量数据", "No traffic data available for this zone"));
  }
  var rows = zones[0].httpRequestsAdaptiveGroups;
  var points = [], requests = 0, bytes = 0;
  rows.forEach(function(row) {
    var count = Number(row && row.count), transfer = Number(row && row.sum && row.sum.edgeResponseBytes);
    var hour = row && row.dimensions && row.dimensions.datetimeHour;
    if (typeof hour !== "string" || !isFinite(count) || count < 0) return;
    requests += count;
    if (isFinite(transfer) && transfer >= 0) bytes += transfer;
    points.push({label:hour.slice(11, 16), value:count});
  });
  return {ok:true, requests:requests, bytes:bytes, points:points.slice(0, 100), start:start.toISOString(), end:end.toISOString()};
}

function cfID(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{32}$/i.test(value)) throw new Error(label + cfText("无效", " is invalid"));
  return value.toLowerCase();
}

function cfPage(value) {
  var page = value == null ? 1 : Number(value);
  if (!Number.isInteger(page) || page < 1 || page > 1000) throw new Error(cfText("页码无效", "Invalid page number"));
  return page;
}

function cfProject(value) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(value)) throw new Error(cfText("Pages 项目名无效", "Invalid Pages project name"));
  return value;
}

function cfSelectedZone() {
  var saved;
  try { saved = JSON.parse(host.storage("get", "selected_zone", "")); } catch (_) { saved = null; }
  return typeof saved === "string" && /^[a-f0-9]{32}$/i.test(saved) ? saved : "";
}

function cfZoneID(value) {
  return cfID(value || cfSelectedZone(), cfText("Zone ID", "Zone ID"));
}

function cfZone(value) {
  return cfRequest("GET", "/zones/" + cfZoneID(value));
}

function cfAccountID(value, zone) {
  if (value) return cfID(value, cfText("账户 ID", "Account ID"));
  if (zone && zone.account && zone.account.id) return cfID(zone.account.id, cfText("账户 ID", "Account ID"));
  var selected = cfSelectedZone();
  if (selected) {
    var fetched = cfZone(selected);
    if (fetched.ok && fetched.data && fetched.data.account && fetched.data.account.id) {
      return cfID(fetched.data.account.id, cfText("账户 ID", "Account ID"));
    }
  }
  var configured = cfConfig().account_id;
  return cfID(configured, cfText("账户 ID", "Account ID"));
}

function cfListZones(page) { return cfRequest("GET", "/zones?per_page=50&page=" + cfPage(page)); }
function cfListDNS(zoneID, page, name) {
  var path = "/zones/" + cfZoneID(zoneID) + "/dns_records?per_page=30&page=" + cfPage(page);
  if (name) path += "&name=" + encodeURIComponent(name);
  return cfRequest("GET", path);
}
function cfListWorkers(accountID) {
  return cfRequest("GET", "/accounts/" + cfAccountID(accountID) + "/workers/scripts");
}
function cfListProjects(accountID, page) {
  return cfRequest("GET", "/accounts/" + cfAccountID(accountID) + "/pages/projects?per_page=20&page=" + cfPage(page));
}
function cfListDeployments(accountID, projectName, page) {
  return cfRequest("GET", "/accounts/" + cfAccountID(accountID) + "/pages/projects/" +
    encodeURIComponent(cfProject(projectName)) + "/deployments?per_page=20&page=" + cfPage(page));
}

function cfRecordName(value, zoneName) {
  if (typeof value !== "string" || !value.trim() || value.length > 253) throw new Error(cfText("记录名无效", "Invalid record name"));
  var name = value.trim().toLowerCase();
  if (name === "@") name = zoneName;
  else if (name.indexOf(".") < 0 || name.indexOf(".") === name.length - 1) name = name.replace(/\.$/, "") + "." + zoneName;
  else name = name.replace(/\.$/, "");
  if (!/^(?:\*\.)?[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/.test(name) ||
      name !== zoneName && name.slice(-(zoneName.length + 1)) !== "." + zoneName) {
    throw new Error(cfText("记录名必须属于所选域名", "Record name must belong to the selected zone"));
  }
  return name;
}

function cfRecordType(value) {
  var type = typeof value === "string" ? value.toUpperCase() : "";
  if (CF_TYPES.indexOf(type) < 0) throw new Error(cfText("仅支持 A、AAAA、CNAME、TXT、MX 记录", "Only A, AAAA, CNAME, TXT and MX records are supported"));
  return type;
}

function cfRecordFields(input, zoneName, type, partial) {
  var output = {};
  if (input.name !== undefined) output.name = cfRecordName(input.name, zoneName);
  else if (!partial) throw new Error(cfText("缺少记录名", "Record name is required"));
  if (input.content !== undefined) {
    if (typeof input.content !== "string" || !input.content.trim() || input.content.length > 2048) {
      throw new Error(cfText("记录值无效", "Invalid record content"));
    }
    output.content = input.content.trim();
    if (type === "A") {
      var octets = output.content.split(".");
      if (octets.length !== 4 || octets.some(function(x) { return !/^\d{1,3}$/.test(x) || Number(x) > 255; })) throw new Error(cfText("IPv4 地址无效", "Invalid IPv4 address"));
    }
    if (type === "AAAA" && !/^[0-9a-f:]+$/i.test(output.content)) throw new Error(cfText("IPv6 地址无效", "Invalid IPv6 address"));
    if ((type === "CNAME" || type === "MX") && !/^[a-z0-9*._-]+\.?$/i.test(output.content)) throw new Error(cfText("目标域名无效", "Invalid target hostname"));
  } else if (!partial) throw new Error(cfText("缺少记录值", "Record content is required"));
  if (input.ttl !== undefined) {
    if (!Number.isInteger(input.ttl) || input.ttl !== 1 && (input.ttl < 30 || input.ttl > 86400)) throw new Error(cfText("TTL 无效", "Invalid TTL"));
    output.ttl = input.ttl;
  }
  if (input.proxied !== undefined) {
    if (["A", "AAAA", "CNAME"].indexOf(type) < 0 || typeof input.proxied !== "boolean") throw new Error(cfText("该记录不支持代理开关", "Proxy setting is unavailable for this record"));
    output.proxied = input.proxied;
  }
  if (input.priority !== undefined) {
    if (type !== "MX" || !Number.isInteger(input.priority) || input.priority < 0 || input.priority > 65535) throw new Error(cfText("MX 优先级无效", "Invalid MX priority"));
    output.priority = input.priority;
  } else if (type === "MX" && !partial) throw new Error(cfText("MX 记录需要优先级", "MX priority is required"));
  return output;
}

function cfGetRecord(zoneID, recordID) {
  return cfRequest("GET", "/zones/" + zoneID + "/dns_records/" + cfID(recordID, cfText("记录 ID", "Record ID")));
}

function cfURL(value, zoneName) {
  if (typeof value !== "string" || value.length > 2048 || /\s|#/.test(value)) throw new Error(cfText("缓存 URL 无效", "Invalid cache URL"));
  var match = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(value);
  if (!match || /[:@]/.test(match[1])) throw new Error(cfText("缓存 URL 必须是完整的 HTTP/HTTPS 地址", "Cache URL must be a full HTTP/HTTPS URL"));
  var hostname = match[1].toLowerCase().replace(/\.$/, "");
  if (hostname !== zoneName && hostname.slice(-(zoneName.length + 1)) !== "." + zoneName) {
    throw new Error(cfText("缓存 URL 不属于所选域名", "Cache URL is outside the selected zone"));
  }
  return value;
}

function cfTool(fn) {
  return function(raw) {
    try { return JSON.stringify(fn(JSON.parse(raw || "{}"))); }
    catch (error) { return JSON.stringify(cfError(cfSafeMessage(error && error.message, cfConfig().token))); }
  };
}

registerTool("zones", cfTool(function(a) {
  var result = cfListZones(a.page);
  if (!result.ok) return result;
  return {ok:true, page:cfPage(a.page), has_more:cfHasMore(result), zones:(result.data || []).map(function(z) {
    return {id:z.id, name:z.name, status:z.status, account_id:z.account && z.account.id, account_name:z.account && z.account.name};
  })};
}));

registerTool("zone_card", cfTool(function(a) {
  var result = cfZone(a.zone_id);
  if (!result.ok) return result;
  var traffic = cfGraphQL(result.data.id);
  var card = cfZoneCard(result.data, traffic);
  var shown = JSON.parse(host.ui("show", JSON.stringify({id:"cfzone" + Date.now().toString(36) + Math.floor(Math.random() * 100000).toString(36),
    title:result.data.name, components:[card]})));
  return {ok:true, shown:shown.ok === true, zone:{id:result.data.id,name:result.data.name,status:result.data.status,
    account_id:result.data.account && result.data.account.id}, traffic:traffic.ok ?
    {requests:traffic.requests, edge_response_bytes:traffic.bytes, from:traffic.start, to:traffic.end} :
    {available:false,error:traffic.error}};
}));

registerTool("dns_records", cfTool(function(a) {
  var result = cfListDNS(a.zone_id, a.page, a.name);
  if (!result.ok) return result;
  return {ok:true, page:cfPage(a.page), has_more:cfHasMore(result), records:(result.data || []).map(cfCompactRecord)};
}));

registerTool("workers", cfTool(function(a) {
  var accountID = cfAccountID(a.account_id);
  var result = cfListWorkers(accountID);
  if (!result.ok) return result;
  var rows = Array.isArray(result.data) ? result.data : result.data && result.data.items || [];
  return {ok:true, account_id:accountID, workers:rows.slice(0, 100).map(function(w) {
    return {id:w.id, modified_on:w.modified_on || w.modified_at || null, created_on:w.created_on || null};
  }), truncated:rows.length > 100};
}));

registerTool("pages_projects", cfTool(function(a) {
  var accountID = cfAccountID(a.account_id);
  var result = cfListProjects(accountID, a.page);
  if (!result.ok) return result;
  return {ok:true, account_id:accountID, page:cfPage(a.page), has_more:cfHasMore(result),
    projects:(result.data || []).map(cfCompactProject)};
}));

registerTool("pages_deployments", cfTool(function(a) {
  var accountID = cfAccountID(a.account_id);
  var result = cfListDeployments(accountID, a.project_name, a.page);
  if (!result.ok) return result;
  return {ok:true, account_id:accountID, project_name:a.project_name, page:cfPage(a.page),
    has_more:cfHasMore(result), deployments:(result.data || []).map(cfCompactDeployment)};
}));

registerTool("create_dns_record", cfTool(function(a) {
  var zone = cfZone(a.zone_id);
  if (!zone.ok) return zone;
  var type = cfRecordType(a.type);
  var body = cfRecordFields(a, zone.data.name.toLowerCase(), type, false);
  body.type = type;
  var result = cfRequest("POST", "/zones/" + zone.data.id + "/dns_records", body);
  if (!result.ok) return result;
  var verified = cfGetRecord(zone.data.id, cfID(result.data.id, cfText("记录 ID", "Record ID")));
  return {ok:true, accepted:true, verified:verified.ok, record:cfCompactRecord(verified.ok ? verified.data : result.data)};
}));

registerTool("update_dns_record", cfTool(function(a) {
  var zone = cfZone(a.zone_id);
  if (!zone.ok) return zone;
  var existing = cfGetRecord(zone.data.id, a.record_id);
  if (!existing.ok) return existing;
  var type = cfRecordType(existing.data.type);
  var body = cfRecordFields(a, zone.data.name.toLowerCase(), type, true);
  if (!Object.keys(body).length) throw new Error(cfText("请指定要修改的字段", "Specify a field to update"));
  var result = cfRequest("PATCH", "/zones/" + zone.data.id + "/dns_records/" + cfID(existing.data.id, cfText("记录 ID", "Record ID")), body);
  if (!result.ok) return result;
  var verified = cfGetRecord(zone.data.id, existing.data.id);
  return {ok:true, accepted:true, verified:verified.ok, before:cfCompactRecord(existing.data),
    record:cfCompactRecord(verified.ok ? verified.data : result.data)};
}));

registerTool("delete_dns_record", cfTool(function(a) {
  var zone = cfZone(a.zone_id);
  if (!zone.ok) return zone;
  var existing = cfGetRecord(zone.data.id, a.record_id);
  if (!existing.ok) return existing;
  cfRecordType(existing.data.type);
  var result = cfRequest("DELETE", "/zones/" + zone.data.id + "/dns_records/" + cfID(existing.data.id, cfText("记录 ID", "Record ID")));
  if (!result.ok) return result;
  var after = cfGetRecord(zone.data.id, existing.data.id);
  return {ok:true, accepted:true, verified:!after.ok && after.status === 404, deleted:cfCompactRecord(existing.data)};
}));

registerTool("purge_cache_urls", cfTool(function(a) {
  var zone = cfZone(a.zone_id);
  if (!zone.ok) return zone;
  if (!Array.isArray(a.urls) || a.urls.length < 1 || a.urls.length > 10) throw new Error(cfText("请提供 1 至 10 个 URL", "Provide 1 to 10 URLs"));
  var urls = a.urls.map(function(url) { return cfURL(url, zone.data.name.toLowerCase()); });
  if (new Set(urls).size !== urls.length) throw new Error(cfText("URL 不能重复", "Duplicate URLs are not allowed"));
  var result = cfRequest("POST", "/zones/" + zone.data.id + "/purge_cache", {files:urls});
  if (!result.ok) return result;
  return {ok:true, accepted:true, zone_id:zone.data.id, urls:urls,
    note:cfText("Cloudflare 已接受清理请求，尚未验证缓存命中状态", "Cloudflare accepted the purge request; cache status was not verified")};
}));

registerTool("retry_pages_deployment", cfTool(function(a) {
  var accountID = cfAccountID(a.account_id), project = cfProject(a.project_name);
  var deploymentID = cfUUID(a.deployment_id);
  var path = "/accounts/" + accountID + "/pages/projects/" + encodeURIComponent(project) + "/deployments/" + deploymentID;
  var existing = cfRequest("GET", path);
  if (!existing.ok) return existing;
  if (!existing.data.latest_stage || existing.data.latest_stage.status !== "failure") {
    throw new Error(cfText("只有失败的 Pages 部署可以重试", "Only failed Pages deployments can be retried"));
  }
  var result = cfRequest("POST", path + "/retry");
  if (!result.ok) return result;
  return {ok:true, accepted:true, account_id:accountID, project_name:project,
    previous_deployment_id:deploymentID, deployment:cfCompactDeployment(result.data),
    note:cfText("已提交重试，最终状态需稍后重新查询", "Retry submitted; query again later for the final status")};
}));

function cfUUID(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new Error(cfText("部署 ID 无效", "Invalid deployment ID"));
  return value.toLowerCase();
}

function cfHasMore(result) {
  var info = result.info || {};
  return Number(info.total_pages) > Number(info.page || 1) || !!info.cursor;
}

function cfCompactRecord(record) {
  if (!record) return null;
  return {id:record.id, type:record.type, name:record.name, content:record.content,
    ttl:record.ttl, proxied:record.proxied, priority:record.priority, modified_on:record.modified_on};
}

function cfCompactProject(project) {
  var deployment = project && project.latest_deployment;
  return {name:project.name, subdomain:project.subdomain, production_branch:project.production_branch,
    latest_deployment:deployment ? cfCompactDeployment(deployment) : null};
}

function cfCompactDeployment(deployment) {
  if (!deployment) return null;
  return {id:deployment.id, environment:deployment.environment,
    status:deployment.latest_stage && deployment.latest_stage.status || null,
    stage:deployment.latest_stage && deployment.latest_stage.name || null,
    created_on:deployment.created_on, modified_on:deployment.modified_on,
    url:deployment.url, is_skipped:deployment.is_skipped === true};
}

function cfFormatBytes(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + " GB";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + " KB";
  return Math.round(bytes) + " B";
}

function cfShort(value, limit) {
  var chars = Array.from(String(value == null ? "" : value));
  return chars.length > limit ? chars.slice(0, limit - 1).join("") + "…" : chars.join("");
}

function cfLabel(id, text, size, muted) {
  return {id:id,text:{text:String(text),fontSize:size || 13,
    weight:size >= 18 ? "PLUGIN_FONT_WEIGHT_SEMIBOLD" : "PLUGIN_FONT_WEIGHT_REGULAR",
    style:muted ? "PLUGIN_TEXT_STYLE_SUBTITLE" : "PLUGIN_TEXT_STYLE_BODY"}};
}

function cfZoneCard(zone, traffic) {
  var name = zone.name || cfText("域名", "Zone");
  var main = [cfLabel("cf-title", cfShort(name, 22), 14, false),
    cfLabel("cf-state", cfText("状态 · ", "Status · ") + (zone.status || "—"), 11, true)];
  var detail = [cfLabel("cf-detail-name", name, 20, false),
    cfLabel("cf-detail-status", cfText("域名状态：", "Zone status: ") + (zone.status || "—"), 14, true)];
  if (traffic.ok) {
    main.push(cfLabel("cf-requests", cfShort(traffic.requests.toLocaleString(), 15), 23, false));
    main.push(cfLabel("cf-transfer", cfText("传输 ", "Transfer ") + cfFormatBytes(traffic.bytes), 11, true));
    detail.push(cfLabel("cf-detail-requests", cfText("近 24 小时请求：", "Requests in 24 h: ") + traffic.requests.toLocaleString(), 15, false));
    detail.push(cfLabel("cf-detail-transfer", cfText("边缘响应传输：", "Edge response transfer: ") + cfFormatBytes(traffic.bytes), 14, true));
    if (traffic.points.length >= 2) {
      main.push({id:"cf-chart",chart:{kind:"PLUGIN_CHART_KIND_AREA",height:56,points:traffic.points,
        appearance:{accent:"PLUGIN_ACCENT_ORANGE"},options:{hideAxes:true}}});
      detail.push({id:"cf-detail-chart",chart:{title:cfText("近 24 小时请求趋势", "24-hour request trend"),
        kind:"PLUGIN_CHART_KIND_AREA",height:160,points:traffic.points,appearance:{accent:"PLUGIN_ACCENT_ORANGE"}}});
    }
  } else {
    main.push(cfLabel("cf-traffic-unavailable", cfText("流量数据暂不可用", "Traffic unavailable"), 12, true));
    detail.push(cfLabel("cf-detail-error", traffic.error || "", 13, true));
  }
  if (zone.account && zone.account.name) detail.push(cfLabel("cf-detail-account", cfText("账户：", "Account: ") + zone.account.name, 13, true));
  return {id:"cf-zone-card",card:{children:main,bottomChildren:[cfLabel("cf-footer", cfText("点击查看详情", "Tap for details"), 10, true)],
    detailTitle:name,detailChildren:detail,expandOnTap:true,aspectRatio:1,padding:8,spacing:4,
    appearance:{accent:"PLUGIN_ACCENT_ORANGE",variant:"PLUGIN_COMPONENT_VARIANT_SURFACE"}}};
}

function cfSectionError(id, result) {
  return {id:id,stateBlock:{kind:"PLUGIN_STATE_KIND_ERROR",title:cfText("暂不可用", "Unavailable"),message:result.error || ""}};
}

function cfListNode(id, items) {
  return {id:id,list:{items:items}};
}

function cfNavigate(id, title, route) {
  return {id:id,button:{title:title,appearance:{accent:"PLUGIN_ACCENT_ORANGE",size:"PLUGIN_COMPONENT_SIZE_COMPACT"},
    onTap:{navigate:{surface:"detail",route:route}}}};
}

function cfSaved(key, fallback) {
  try { var value = JSON.parse(host.storage("get", key, "")); return value == null ? fallback : value; }
  catch (_) { return fallback; }
}

function cfStore(key, value) {
  var result = JSON.parse(host.storage("put", key, JSON.stringify(value)));
  if (!result.saved) throw new Error(cfText("无法保存选择", "Could not save selection"));
}

function cfPageActions(route, page, hasMore) {
  var actions = [{title:cfText("刷新", "Refresh"),onTap:{plugin:{actionId:"refresh"}}}];
  if (page > 1) actions.push({title:cfText("上一页", "Previous"),onTap:{plugin:{actionId:"change_page",params:{route:route,page:String(page - 1)}}}});
  if (hasMore) actions.push({title:cfText("下一页", "Next"),onTap:{plugin:{actionId:"change_page",params:{route:route,page:String(page + 1)}}}});
  return actions;
}

function dashboard(ctx) {
  if (!cfConfig().token) return {title:"Cloudflare",components:[
    cfSectionError("cf-config", cfError(cfText("请在 Agent 的插件配置中填写 API Token", "Set an API Token in the Agent's plugin settings"))),
    cfLabel("cf-token-guide", cfText("按所需功能选择最小权限，创建后将 Token 粘贴到插件配置。", "Choose only the permissions you need, then paste the new token into the plugin settings."), 13, true),
    {id:"cf-create-token",button:{title:cfText("前往 Cloudflare 创建 Token", "Create a Cloudflare token"),
      appearance:{accent:"PLUGIN_ACCENT_ORANGE",size:"PLUGIN_COMPONENT_SIZE_COMPACT"},
      onTap:{openURL:CF_TOKEN_URL}}}
  ]};
  var components = [];
  var zones = cfListZones(1);
  var selectedID = cfSelectedZone();
  var zone = null;
  if (selectedID) {
    var current = cfZone(selectedID);
    if (current.ok) zone = current.data;
  }
  if (!zone && zones.ok && Array.isArray(zones.data) && zones.data.length) zone = zones.data[0];
  if (zone) {
    components.push(cfLabel("cf-zone-heading", cfText("域名与流量", "Zone and traffic"), 18, false));
    components.push(cfZoneCard(zone, cfGraphQL(zone.id)));
  } else if (!zones.ok) components.push(cfSectionError("cf-zones-error", zones));
  else components.push(cfLabel("cf-zones-empty", cfText("当前令牌没有可列出的域名", "No zones are available to this token"), 13, true));
  components.push(cfNavigate("cf-zones-link", cfText("查看域名", "Browse zones"), "zones"));
  if (zone) components.push(cfNavigate("cf-dns-link", cfText("查看 DNS 记录", "Browse DNS records"), "dns"));
  var accountID = "";
  try { accountID = cfAccountID(null, zone); } catch (_) { /* Account-only setups can add an ID later. */ }
  if (accountID) {
    components.push(cfLabel("cf-deploy-heading", cfText("部署", "Deployments"), 18, false));
    var workers = cfListWorkers(accountID);
    if (workers.ok) {
      var scripts = Array.isArray(workers.data) ? workers.data : workers.data && workers.data.items || [];
      components.push(cfLabel("cf-workers-count", "Workers · " + scripts.length, 14, false));
      components.push(cfNavigate("cf-workers-link", cfText("查看 Workers", "Browse Workers"), "workers"));
    } else components.push(cfSectionError("cf-workers-error", workers));
    var pages = cfListProjects(accountID, 1);
    if (pages.ok) {
      components.push(cfLabel("cf-pages-count", "Pages · " + (pages.info.total_count || (pages.data || []).length), 14, false));
      var items = (pages.data || []).slice(0, 3).map(function(project) {
        var latest = project.latest_deployment;
        return {title:cfShort(project.name, 40),subtitle:latest && latest.latest_stage && latest.latest_stage.status || "—",
          onTap:{plugin:{actionId:"open_project",params:{name:project.name}}}};
      });
      if (items.length) components.push(cfListNode("cf-pages-preview", items));
      components.push(cfNavigate("cf-pages-link", cfText("查看 Pages", "Browse Pages"), "pages"));
    } else components.push(cfSectionError("cf-pages-error", pages));
  } else components.push(cfLabel("cf-account-hint", cfText("查看 Workers 和 Pages 需填写账户 ID，或选择一个域名", "Enter an account ID or select a zone to browse Workers and Pages"), 13, true));
  return {title:"Cloudflare",components:components,
    navigationActions:[{title:cfText("刷新", "Refresh"),onTap:{plugin:{actionId:"refresh"}}}]};
}

function detail(ctx) {
  var route = ctx.route || "zones";
  var page = cfPage(cfSaved("page_" + route.replace(/-/g, "_"), 1));
  var components = [], result, title;
  if (route === "zones") {
    title = cfText("域名", "Zones"); result = cfListZones(page);
    if (result.ok) components.push(cfListNode("cf-zones-list", (result.data || []).map(function(z) {
      return {title:z.name,subtitle:z.status + (z.account && z.account.name ? " · " + z.account.name : ""),
        onTap:{plugin:{actionId:"select_zone",params:{zone_id:z.id}}}};
    })));
  } else if (route === "dns") {
    title = "DNS"; result = cfListDNS(null, page);
    if (result.ok) components.push(cfListNode("cf-dns-list", (result.data || []).map(function(r) {
      return {title:cfShort(r.type + " · " + r.name, 60),subtitle:cfShort(r.content, 90)};
    })));
  } else if (route === "workers") {
    title = "Workers"; result = cfListWorkers();
    if (result.ok) {
      var workers = Array.isArray(result.data) ? result.data : result.data && result.data.items || [];
      components.push(cfListNode("cf-workers-list", workers.slice(0, 100).map(function(w) {
        return {title:w.id,subtitle:w.modified_on || w.modified_at || ""};
      })));
    }
  } else if (route === "pages") {
    title = "Pages"; result = cfListProjects(null, page);
    if (result.ok) components.push(cfListNode("cf-pages-list", (result.data || []).map(function(p) {
      var status = p.latest_deployment && p.latest_deployment.latest_stage && p.latest_deployment.latest_stage.status || "—";
      return {title:p.name,subtitle:status,onTap:{plugin:{actionId:"open_project",params:{name:p.name}}}};
    })));
  } else if (route === "pages-project") {
    var project = cfSaved("selected_project", "");
    title = project || "Pages";
    if (!project) result = cfError(cfText("请先选择 Pages 项目", "Select a Pages project first"));
    else result = cfListDeployments(null, project, page);
    if (result.ok) components.push(cfListNode("cf-deployments-list", (result.data || []).map(function(d) {
      var compact = cfCompactDeployment(d);
      return {title:(compact.environment || "—") + " · " + (compact.status || "—"),
        subtitle:cfShort((compact.created_on || "") + " · " + (compact.id || ""), 80)};
    })));
  } else return {title:"Cloudflare",components:[cfSectionError("cf-route-error", cfError(cfText("页面不存在", "Page not found")))]};
  if (!result.ok) components.push(cfSectionError("cf-detail-error", result));
  else if (!components.length || components[0].list && !components[0].list.items.length) components.push(cfLabel("cf-empty", cfText("暂无数据", "No data"), 13, true));
  return {title:title,components:components,
    navigationActions:cfPageActions(route, page, route !== "workers" && result.ok && cfHasMore(result))};
}

var actions = {
  refresh:function() { return {effects:[{refresh:{surface:"current"}}]}; },
  select_zone:function(ctx) {
    cfStore("selected_zone", cfID(ctx.params.zone_id, cfText("Zone ID", "Zone ID")));
    cfStore("page_dns", 1);
    return {effects:[{refresh:{surface:"current"}},{toast:{text:cfText("已切换域名", "Zone selected")}}]};
  },
  open_project:function(ctx) {
    cfStore("selected_project", cfProject(ctx.params.name));
    cfStore("page_pages_project", 1);
    return {effects:[{navigate:{surface:"detail",route:"pages-project"}}]};
  },
  change_page:function(ctx) {
    var route = ctx.params.route;
    if (["zones", "dns", "pages", "pages-project"].indexOf(route) < 0) throw new Error(cfText("页面无效", "Invalid page"));
    cfStore("page_" + route.replace(/-/g, "_"), cfPage(ctx.params.page));
    return {effects:[{refresh:{surface:"current"}}]};
  }
};
