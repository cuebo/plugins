var CF_API = "https://api.cloudflare.com/client/v4";
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

function cfAuthorizedRequest(request, config) {
  request.auth = "oauth";
  try {
    var oauthResponse = JSON.parse(host.request(JSON.stringify(request)));
    oauthResponse.authMethod = "oauth";
    return oauthResponse;
  } catch (error) {
    if (String(error).indexOf("请先连接插件账号") < 0) throw error;
    if (!config.token) throw new Error(cfText("请先连接 Cloudflare 账号，或填写手动 API Token",
      "Connect Cloudflare or configure a manual API Token first"));
  }
  delete request.auth;
  request.headers.Authorization = "Bearer " + config.token;
  var manualResponse = JSON.parse(host.request(JSON.stringify(request)));
  manualResponse.authMethod = "manual";
  return manualResponse;
}

function cfAuthError(response) {
  if (response.status !== 401) return "";
  return response.authMethod === "oauth" ?
    cfText("Cloudflare 网页授权已失效，请在插件设置中重新连接", "Cloudflare authorization expired; reconnect in plugin settings") :
    cfText("手动 API Token 无效，请在插件设置中更换或清除", "Manual API Token is invalid; replace or clear it in plugin settings");
}

function cfRequest(method, path, payload) {
  var config = cfConfig();
  var request = {method:method, url:CF_API + path,
    headers:{"Accept":"application/json"}};
  if (payload !== undefined) {
    request.headers["Content-Type"] = "application/json";
    request.body = JSON.stringify(payload);
  }
  var response;
  try { response = cfAuthorizedRequest(request, config); }
  catch (error) { return cfError(cfSafeMessage(error && error.message, config.token) || cfText("网络或授权失败", "Network or authorization failed")); }
  var body;
  try { body = JSON.parse(response.body || "{}"); }
  catch (_) { return cfError(cfText("Cloudflare 返回了无效数据", "Cloudflare returned invalid data"), response.status); }
  if (response.status < 200 || response.status >= 300 || body.success !== true || body.errors && body.errors.length) {
    var first = body.errors && body.errors[0];
    var detail = first && first.message || body.message || cfText("Cloudflare 请求失败", "Cloudflare request failed");
    return cfError(cfAuthError(response) || cfSafeMessage(detail, config.token), response.status);
  }
  return {ok:true, status:response.status, data:body.result, info:body.result_info || {}};
}

function cfGraphQL(zoneID) {
  var config = cfConfig();
  var end = new Date();
  var start = new Date(end.getTime() - 24 * 3600000);
  var query = "query($zoneTag: string!, $start: Time!, $end: Time!) { viewer { zones(filter: {zoneTag: $zoneTag}) { httpRequestsAdaptiveGroups(limit: 100, filter: {datetime_geq: $start, datetime_lt: $end, requestSource: \"eyeball\"}, orderBy: [datetimeHour_ASC]) { dimensions { datetimeHour } count sum { edgeResponseBytes } } } } }";
  var request = {method:"POST",url:CF_API + "/graphql",headers:{"Accept":"application/json",
    "Content-Type":"application/json"},
    body:JSON.stringify({query:query,variables:{zoneTag:zoneID,start:start.toISOString(),end:end.toISOString()}})};
  var response, body;
  try { response = cfAuthorizedRequest(request, config); }
  catch (error) { return cfError(cfSafeMessage(error && error.message, config.token)); }
  try { body = JSON.parse(response.body || "{}"); }
  catch (_) { return cfError(cfText("流量数据无效", "Invalid traffic response"), response.status); }
  if (response.status < 200 || response.status >= 300 || body.errors && body.errors.length) {
    return cfError(cfAuthError(response) || cfSafeMessage(body.errors && body.errors[0] && body.errors[0].message ||
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

function cfZoneID(value) {
  return cfID(value, cfText("Zone ID", "Zone ID"));
}

function cfZone(value) {
  return cfRequest("GET", "/zones/" + cfZoneID(value));
}

function cfAccountID(value) {
  if (value) return cfID(value, cfText("账户 ID", "Account ID"));
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

registerTool("zone_overview", cfTool(function(a) {
  var result = cfZone(a.zone_id);
  if (!result.ok) return result;
  var traffic = cfGraphQL(result.data.id);
  return {ok:true, zone:{id:result.data.id,name:result.data.name,status:result.data.status,
    account_id:result.data.account && result.data.account.id}, traffic:traffic.ok ?
    {requests:traffic.requests, edge_response_bytes:traffic.bytes, hourly_requests:traffic.points,
      from:traffic.start, to:traffic.end} :
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
