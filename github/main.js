function cleanName(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_.-]{1,100}$/.test(value) || value === "." || value === "..") throw new Error(label + " 无效");
  return encodeURIComponent(value);
}
function repoPath(input) { return "/repos/" + cleanName(input.owner, "owner") + "/" + cleanName(input.repo, "repo"); }
function number(value) { var n = Number(value); if (!Number.isInteger(n) || n < 1 || n > 1000000000) throw new Error("编号无效"); return n; }
function text(value, label, limit, required) {
  if (value == null || value === "") { if (required) throw new Error(label + " 不能为空"); return ""; }
  if (typeof value !== "string" || value.length > limit) throw new Error(label + " 过长或无效");
  return value;
}
function api(method, path, body) {
  var config = JSON.parse(host.config());
  if (!config.token) return JSON.stringify({ok:false, error:"请先在此 Agent 的 GitHub 插件配置中填写访问令牌"});
  var response = JSON.parse(host.request(JSON.stringify({
    method:method, url:"https://api.github.com" + path,
    headers:{"Accept":"application/vnd.github+json", "Authorization":"Bearer " + config.token,
      "X-GitHub-Api-Version":"2022-11-28", "Content-Type":"application/json"},
    body:body == null ? "" : JSON.stringify(body)
  })));
  var data;
  try { data = JSON.parse(response.body || "null"); } catch (_) { data = response.body || ""; }
  if (response.status < 200 || response.status >= 300) return JSON.stringify({ok:false,status:response.status,error:data && data.message ? data.message : "GitHub 请求失败"});
  return JSON.stringify({ok:true,status:response.status,data:compact(data)});
}
function compact(data) {
  if (Array.isArray(data)) return data.slice(0,30).map(compact);
  if (!data || typeof data !== "object") return data;
  var keys = ["id","number","name","full_name","private","description","html_url","default_branch","title","state","body","created_at","updated_at","draft","merged","mergeable","head","base","user","login","comments","open_issues_count"];
  var out = {};
  keys.forEach(function(k) { if (data[k] !== undefined) {
    if (k === "head" || k === "base") out[k] = data[k] && {ref:data[k].ref,sha:data[k].sha};
    else if (k === "user") out[k] = data[k] && data[k].login;
    else if (k === "body" && typeof data[k] === "string") out[k] = data[k].slice(0,4000);
    else out[k] = data[k];
  }});
  return out;
}
function state(value) { return value === "closed" || value === "all" ? value : "open"; }
registerTool("repos", function(raw) { var a=JSON.parse(raw), p=Math.max(1,Math.min(100,Number(a.page)||1)); return api("GET","/user/repos?sort=updated&per_page=30&page="+p); });
registerTool("issues", function(raw) { var a=JSON.parse(raw); return api("GET",repoPath(a)+"/issues?state="+state(a.state)+"&per_page=30"); });
registerTool("pulls", function(raw) { var a=JSON.parse(raw); return api("GET",repoPath(a)+"/pulls?state="+state(a.state)+"&per_page=30"); });
registerTool("create_issue", function(raw) { var a=JSON.parse(raw); return api("POST",repoPath(a)+"/issues",{title:text(a.title,"标题",256,true),body:text(a.body,"正文",50000,false)}); });
registerTool("comment_issue", function(raw) { var a=JSON.parse(raw); return api("POST",repoPath(a)+"/issues/"+number(a.number)+"/comments",{body:text(a.body,"评论",50000,true)}); });
registerTool("create_pull", function(raw) { var a=JSON.parse(raw); return api("POST",repoPath(a)+"/pulls",{title:text(a.title,"标题",256,true),head:text(a.head,"来源分支",256,true),base:text(a.base,"目标分支",256,true),body:text(a.body,"正文",50000,false)}); });
