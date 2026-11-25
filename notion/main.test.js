const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const tools = {};
const requests = [];
let manualToken = "";
let oauthAvailable = true;
const context = {
  registerTool(name, fn) { tools[name] = fn; },
  host: {
    config() { return JSON.stringify({token:manualToken}); },
    language() { return "zh-Hans"; },
    request(raw) {
      const request = JSON.parse(raw);
      requests.push(request);
      if (request.auth === "oauth" && !oauthAvailable) throw new Error("请先连接插件账号，或重新授权");
      let body = {};
      if (request.url.endsWith("/search")) body = {results:[{id:"a".repeat(32),object:"page",url:"https://notion.so/page",
        properties:{Name:{type:"title",title:[{plain_text:"计划"}]}}}],has_more:false};
      else if (request.url.includes("/pages/") && request.method === "GET") body =
        {id:"a".repeat(32),object:"page",properties:{Name:{type:"title",title:[{plain_text:"计划"}]}}};
      else if (request.url.includes("/children") && request.method === "GET") body =
        {results:[{id:"b".repeat(32),type:"paragraph",paragraph:{rich_text:[{plain_text:"正文"}]},has_children:false}],has_more:false};
      else if (request.url.includes("/data_sources/")) body = {results:[],has_more:false};
      else if (request.method === "POST" && request.url.endsWith("/pages")) body =
        {id:"c".repeat(32),object:"page",properties:{title:{type:"title",title:[{plain_text:"新页面"}]}}};
      else if (request.method === "PATCH") body = {results:[{id:"d".repeat(32)}]};
      return JSON.stringify({status:200,body:JSON.stringify(body)});
    }
  }
};
vm.runInNewContext(fs.readFileSync(new URL("./main.js", `file://${__dirname}/`), "utf8"), context);
const call = (name, args) => JSON.parse(tools[name](JSON.stringify(args)));
const ids = Object.keys(tools).sort();
assert.deepEqual(ids, ["append_page_text","create_page","list_block_children","query_data_source","read_page","search"]);
assert.equal(call("search", {query:"计划"}).items[0].title, "计划");
assert.equal(call("search", {query:"计划"}).search_scope, "title_only");
assert.equal(requests.at(-1).headers["Notion-Version"], "2026-03-11");
assert.equal(requests.at(-1).auth, "oauth");
const page = call("read_page", {page_id:"a".repeat(32)});
assert.equal(page.page.title, "计划");
assert.equal(page.blocks[0].text, "正文");
assert.equal(call("query_data_source", {data_source_id:"a".repeat(32)}).ok, true);
assert.equal(call("create_page", {parent_page_id:"a".repeat(32),title:"新页面",text:"内容"}).page.title, "新页面");
assert.equal(JSON.parse(requests.at(-1).body).parent.page_id, "a".repeat(32));
assert.equal(call("append_page_text", {page_id:"a".repeat(32),text:"追加"}).appended_block_ids[0], "d".repeat(32));
assert.equal(call("read_page", {page_id:"not-an-id"}).ok, false);
oauthAvailable = false;
manualToken = "manual-token";
assert.equal(call("search", {}).ok, true);
assert.equal(requests.at(-1).headers.Authorization, "Bearer manual-token");
console.log("Notion plugin tests passed");
