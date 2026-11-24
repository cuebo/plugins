const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const zoneID = "a".repeat(32);
const accountID = "b".repeat(32);
const recordID = "c".repeat(32);
const deploymentID = "01234567-89ab-4cde-8fab-0123456789ab";
const zone = {id: zoneID, name: "example.com", status: "active", account: {id: accountID, name: "Main"}};
let record = {id: recordID, zone_id: zoneID, type: "A", name: "www.example.com", content: "192.0.2.1", ttl: 1, proxied: true};
let deploymentStatus = "failure";
let denied = new Set();
let token = "test-token";
let oauthConnected = true;
let unauthorized = false;
let language = "zh-Hans";
const requests = [];
const tools = {};

function apiResponse(result, extra = {}) {
  return JSON.stringify({status: 200, body: JSON.stringify({success: true, result, ...extra})});
}
function notFound() {
  return JSON.stringify({status: 404, body: JSON.stringify({success: false, errors: [{message: "not found"}]})});
}
const host = {
  language: () => language,
  config: () => JSON.stringify({token, account_id: accountID}),
  request: raw => {
    const request = JSON.parse(raw);
    assert(request.url.startsWith("https://api.cloudflare.com/client/v4/"));
    if (request.auth === "oauth") {
      assert.strictEqual(request.headers.Authorization, undefined);
      if (!oauthConnected) throw new Error("请先连接插件账号，或重新授权");
    } else {
      assert.strictEqual(request.headers.Authorization, "Bearer " + token);
    }
    requests.push(request);
    if (unauthorized) return JSON.stringify({status: 401, body: JSON.stringify({success: false, errors: [{message: "invalid credentials"}]})});
    const path = request.url.slice("https://api.cloudflare.com/client/v4".length);
    if (denied.has(path.split("?")[0])) return JSON.stringify({status: 403, body: JSON.stringify({success: false, errors: [{message: "permission denied"}]})});
    if (path === "/graphql") {
      assert.strictEqual(request.method, "POST");
      const body = JSON.parse(request.body);
      assert.strictEqual(body.variables.zoneTag, zoneID);
      assert(body.query.includes('requestSource: "eyeball"'));
      return JSON.stringify({status: 200, body: JSON.stringify({data: {viewer: {zones: [{httpRequestsAdaptiveGroups: [
        {dimensions: {datetimeHour: "2026-11-21T00:00:00Z"}, count: 9, sum: {edgeResponseBytes: 1024}},
        {dimensions: {datetimeHour: "2026-11-21T01:00:00Z"}, count: 12, sum: {edgeResponseBytes: 2048}},
      ]}]}}})});
    }
    if (path.startsWith("/zones?")) return apiResponse([zone], {result_info: {page: 1, total_pages: 1, total_count: 1}});
    if (path === `/zones/${zoneID}`) return apiResponse(zone);
    if (path.startsWith(`/zones/${zoneID}/dns_records?`)) return apiResponse(record ? [record] : [], {result_info: {page: 1, total_pages: 1}});
    if (path === `/zones/${zoneID}/dns_records/${recordID}`) {
      if (request.method === "GET") return record ? apiResponse(record) : notFound();
      if (request.method === "PATCH") { record = {...record, ...JSON.parse(request.body)}; return apiResponse(record); }
      if (request.method === "DELETE") { record = null; return apiResponse({id: recordID}); }
    }
    if (path === `/zones/${zoneID}/dns_records` && request.method === "POST") {
      record = {id: recordID, zone_id: zoneID, ...JSON.parse(request.body)};
      return apiResponse(record);
    }
    if (path === `/zones/${zoneID}/purge_cache` && request.method === "POST") return apiResponse({id: "purge-id"});
    if (path === `/accounts/${accountID}/workers/scripts`) return apiResponse([{id: "worker-one", modified_on: "2026-11-20T00:00:00Z"}]);
    if (path.startsWith(`/accounts/${accountID}/pages/projects?`)) return apiResponse([
      {name: "site", subdomain: "site.pages.dev", latest_deployment: {id: deploymentID, latest_stage: {status: deploymentStatus}}},
    ], {result_info: {page: 1, total_pages: 1}});
    if (path.startsWith(`/accounts/${accountID}/pages/projects/site/deployments?`)) return apiResponse([
      {id: deploymentID, environment: "production", latest_stage: {status: deploymentStatus}},
    ], {result_info: {page: 1, total_pages: 1}});
    if (path === `/accounts/${accountID}/pages/projects/site/deployments/${deploymentID}`) {
      return apiResponse({id: deploymentID, latest_stage: {status: deploymentStatus}});
    }
    if (path === `/accounts/${accountID}/pages/projects/site/deployments/${deploymentID}/retry`) return apiResponse({id: deploymentID, latest_stage: {status: "queued"}});
    throw new Error(`Unexpected request ${request.method} ${path}`);
  },
};
const context = {
  host, registerTool: (name, run) => { tools[name] = run; },
  JSON, Date, Math, Number, Object, String, Array, Set, isFinite,
};
vm.runInNewContext(fs.readFileSync(__dirname + "/main.js", "utf8"), context);

function invoke(name, input = {}) { return JSON.parse(tools[name](JSON.stringify(input))); }
function lastRequest() { return requests[requests.length - 1]; }

const manifest = JSON.parse(fs.readFileSync(__dirname + "/plugin.json", "utf8"));
assert.strictEqual(manifest.oauth.provider, "cloudflare");
assert.strictEqual(manifest.oauth.redirectURL, "https://oauth.myservers.plus/cloudflare");
assert.strictEqual(manifest.oauth.callbackURL, "cuebo://plugin-auth/cloudflare");
assert.strictEqual(manifest.oauth.tokenField, "token");
assert.deepStrictEqual(manifest.oauth.apiHosts, manifest.networkHosts);
for (const scope of ["page.read", "page.write", "workers-scripts.content_read", "dns.read", "dns.write",
                     "zone.read", "analytics.read", "cache.purge", "offline_access"]) {
  assert(manifest.oauth.scope.split(" ").includes(scope));
}
assert.strictEqual(manifest.tools.length, Object.keys(tools).length);
assert.notStrictEqual(manifest.ui, true);
assert(!manifest.uiProtocol && !manifest.capabilities?.includes("generative_ui"));
assert.strictEqual(context.dashboard, undefined);
assert.strictEqual(context.detail, undefined);
for (const tool of manifest.tools) {
  assert(tools[tool.name], `missing ${tool.name}`);
  if (/^(create_|update_|delete_|purge_|retry_)/.test(tool.name)) assert.strictEqual(tool.requiresApproval, true);
}
assert.strictEqual(invoke("zones").zones[0].name, "example.com");
assert.strictEqual(invoke("dns_records", {zone_id: zoneID}).records[0].content, "192.0.2.1");
assert.strictEqual(invoke("workers").workers[0].id, "worker-one");
assert.strictEqual(invoke("pages_projects").projects[0].latest_deployment.status, "failure");
assert.strictEqual(invoke("pages_deployments", {project_name: "site"}).deployments[0].status, "failure");
const overview = invoke("zone_overview", {zone_id: zoneID});
assert.strictEqual(overview.traffic.requests, 21);
assert.strictEqual(overview.traffic.edge_response_bytes, 3072);
assert.strictEqual(overview.traffic.hourly_requests.length, 2);
assert.strictEqual(overview.zone.name, "example.com");
assert.strictEqual(overview.shown, undefined);
assert.strictEqual(invoke("zone_overview").ok, false);
assert.strictEqual(invoke("dns_records").ok, false);

assert.strictEqual(invoke("create_dns_record", {zone_id: zoneID, type: "A", name: "api", content: "192.0.2.2"}).verified, true);
assert.strictEqual(lastRequest().method, "GET");
assert.strictEqual(record.name, "api.example.com");
assert.strictEqual(invoke("update_dns_record", {zone_id: zoneID, record_id: recordID, content: "192.0.2.3"}).verified, true);
assert.strictEqual(record.content, "192.0.2.3");
assert.strictEqual(invoke("update_dns_record", {zone_id: zoneID, record_id: recordID}).ok, false);
assert.strictEqual(invoke("create_dns_record", {zone_id: zoneID, type: "MX", name: "@", content: "mail.example.com"}).ok, false);
assert.strictEqual(invoke("create_dns_record", {zone_id: zoneID, type: "CNAME", name: "outside.net", content: "target.net"}).ok, false);
assert.strictEqual(invoke("purge_cache_urls", {zone_id: zoneID, urls: ["https://www.example.com/file.css"]}).accepted, true);
assert.deepStrictEqual(JSON.parse(requests.filter(r => r.url.endsWith("/purge_cache")).pop().body).files, ["https://www.example.com/file.css"]);
assert.strictEqual(invoke("purge_cache_urls", {zone_id: zoneID, urls: ["https://notexample.com/file"]}).ok, false);
assert.strictEqual(invoke("purge_cache_urls", {zone_id: zoneID, urls: ["https://example.com/a", "https://example.com/a"]}).ok, false);
assert.strictEqual(invoke("retry_pages_deployment", {project_name: "site", deployment_id: deploymentID}).accepted, true);
deploymentStatus = "success";
const beforeRetry = requests.length;
assert.strictEqual(invoke("retry_pages_deployment", {project_name: "site", deployment_id: deploymentID}).ok, false);
assert.strictEqual(requests.length, beforeRetry + 1);
assert.strictEqual(invoke("delete_dns_record", {zone_id: zoneID, record_id: recordID}).verified, true);
assert.strictEqual(record, null);

denied.add("/graphql");
const degraded = invoke("zone_overview", {zone_id: zoneID});
assert.strictEqual(degraded.ok, true);
assert.strictEqual(degraded.traffic.available, false);
denied.clear();
assert.strictEqual(context.actions, undefined);

assert.strictEqual(requests[0].auth, "oauth");
assert.strictEqual(requests.find(r => r.url.endsWith("/graphql")).auth, "oauth");
oauthConnected = false;
assert.strictEqual(invoke("zones").ok, true);
assert.strictEqual(lastRequest().headers.Authorization, "Bearer test-token");
unauthorized = true;
assert.strictEqual(invoke("zones").error, "手动 API Token 无效，请在插件设置中更换或清除");
unauthorized = false;
oauthConnected = true;
assert.strictEqual(invoke("zones").ok, true);
unauthorized = true;
assert.strictEqual(invoke("zones").error, "Cloudflare 网页授权已失效，请在插件设置中重新连接");
unauthorized = false;
oauthConnected = false;
token = "";
const requestCount = requests.length;
assert.strictEqual(invoke("zones").ok, false);
assert.strictEqual(requests.length, requestCount);
language = "en";
assert.strictEqual(invoke("zones").error, "Connect Cloudflare or configure a manual API Token first");
console.log("Cloudflare plugin tests passed");
