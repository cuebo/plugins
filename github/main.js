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
  var keys = ["id","number","name","full_name","private","description","html_url","default_branch","title","state","body","created_at","updated_at","draft","merged","mergeable","head","base","user","login","comments","open_issues_count","merged","sha","message"];
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

registerTool("issue", function(raw) { var a=JSON.parse(raw); return api("GET",repoPath(a)+"/issues/"+number(a.number)); });
registerTool("pull", function(raw) { var a=JSON.parse(raw); return api("GET",repoPath(a)+"/pulls/"+number(a.number)); });
registerTool("update_issue", function(raw) { var a=JSON.parse(raw), change={}; if (a.title != null) change.title=text(a.title,"标题",256,true); if (a.body != null) change.body=text(a.body,"正文",50000,false); if (a.state != null) { if (a.state!=="open" && a.state!=="closed") throw new Error("状态无效"); change.state=a.state; } if (!Object.keys(change).length) throw new Error("请指定要修改的字段"); return api("PATCH",repoPath(a)+"/issues/"+number(a.number),change); });
registerTool("merge_pull", function(raw) { var a=JSON.parse(raw), method=a.merge_method||"merge"; if (["merge","squash","rebase"].indexOf(method)<0) throw new Error("合并方式无效"); var change={merge_method:method}; if (a.commit_title != null) change.commit_title=text(a.commit_title,"提交标题",256,true); return api("PUT",repoPath(a)+"/pulls/"+number(a.number)+"/merge",change); });

function profileGraphQL(query, variables) {
  var config = JSON.parse(host.config());
  if (!config.token) return {ok:false,error:"请先在此 Agent 的 GitHub 插件配置中填写访问令牌"};
  var response = JSON.parse(host.request(JSON.stringify({
    method:"POST",url:"https://api.github.com/graphql",
    headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer " + config.token,
      "X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"},
    body:JSON.stringify({query:query,variables:variables})
  })));
  var body;
  try { body = JSON.parse(response.body || "{}"); } catch (_) { body = {}; }
  if (response.status < 200 || response.status >= 300 || !body.data || body.errors && body.errors.length) {
    return {ok:false,status:response.status,error:body.errors && body.errors[0] && body.errors[0].message ||
      body.message || "GitHub 数据查询失败"};
  }
  return {ok:true,data:body.data};
}

function profileCount(value) {
  if (value < 1000) return String(value);
  return (Math.round(value / 100) / 10).toFixed(1).replace(/\.0$/, "") + "k";
}

function profileLevel(value) {
  return {NONE:0,FIRST_QUARTILE:1,SECOND_QUARTILE:2,THIRD_QUARTILE:3,FOURTH_QUARTILE:4}[value] || 0;
}

function profileText(id, value, style, accent) {
  var content = {text:String(value),style:style};
  if (accent) content.appearance = {accent:accent};
  return {id:id,text:content};
}

function profileIcon(id, name) {
  return {id:id,icon:{appearance:{accent:"PLUGIN_ACCENT_GREEN",iconSource:{systemName:name}}}};
}

function profileTile(id, title, value, symbol, accent) {
  return {id:id,card:{appearance:{variant:"PLUGIN_COMPONENT_VARIANT_DARK"},children:[
    {id:id+"-heading",stack:{axis:"PLUGIN_LAYOUT_AXIS_HORIZONTAL",spacing:6,children:[
      profileIcon(id+"-icon",symbol),
      profileText(id+"-title",title,"PLUGIN_TEXT_STYLE_CAPTION")
    ]}},
    profileText(id+"-value",value,"PLUGIN_TEXT_STYLE_DISPLAY",accent)
  ]}};
}

function repositoryHTTP(path) {
  var config = JSON.parse(host.config());
  if (!config.token) return {ok:false,error:"请先在此 Agent 的 GitHub 插件配置中填写访问令牌"};
  var response;
  try {
    response = JSON.parse(host.request(JSON.stringify({
      method:"GET",url:"https://api.github.com" + path,
      headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer " + config.token,
        "X-GitHub-Api-Version":"2022-11-28"}
    })));
  } catch (_) { return {ok:false,error:"GitHub 附加数据暂不可用"}; }
  var data;
  try { data = JSON.parse(response.body || "null"); } catch (_) { data = null; }
  if (response.status < 200 || response.status >= 300) {
    return {ok:false,status:response.status,error:data && data.message || "GitHub 请求失败"};
  }
  return {ok:true,status:response.status,data:data,link:response.link || ""};
}

function repositoryContributorCount(owner, repo) {
  var answer = repositoryHTTP("/repos/" + cleanName(owner,"owner") + "/" + cleanName(repo,"repo") +
    "/contributors?per_page=1&anon=true");
  if (!answer.ok) return null;
  if (answer.status === 204) return 0;
  if (!Array.isArray(answer.data)) return null;
  var lastURL = /<([^>]+)>;\s*rel="last"/.exec(answer.link);
  var last = lastURL && /[?&]page=(\d+)(?:&|$)/.exec(lastURL[1]);
  return last ? Number(last[1]) : answer.data.length;
}

function repositoryTechnology(repo) {
  var names = [];
  function add(name) { if (name && names.indexOf(name) < 0 && names.length < 5) names.push(name); }
  add(repo.primaryLanguage && repo.primaryLanguage.name);
  var blob = repo.packageJSON;
  if (!blob || blob.isTruncated || typeof blob.text !== "string" || blob.text.length > 100000) return names;
  var manifest;
  try { manifest = JSON.parse(blob.text); } catch (_) { return names; }
  var deps = {};
  [manifest.dependencies,manifest.devDependencies,manifest.peerDependencies].forEach(function(group) {
    if (group && typeof group === "object") Object.keys(group).forEach(function(key) { deps[key] = true; });
  });
  [["react","React"],["vue","Vue"],["next","Next.js"],["vite","Vite"],
    ["tailwindcss","Tailwind"],["storybook","Storybook"],["svelte","Svelte"],
    ["@angular/core","Angular"],["nuxt","Nuxt"]].forEach(function(item) {
    if (deps[item[0]] || item[0] === "storybook" && Object.keys(deps).some(function(key) {
      return key.indexOf("@storybook/") === 0;
    })) add(item[1]);
  });
  return names;
}

function repositoryUpdated(value) {
  var time = Date.parse(value || "");
  if (!isFinite(time)) return "暂无记录";
  var hours = Math.max(0,Math.floor((Date.now() - time) / 3600000));
  if (hours < 1) return "刚刚";
  if (hours < 24) return hours + " 小时前";
  var days = Math.floor(hours / 24);
  if (days < 30) return days + " 天前";
  if (days < 365) return Math.floor(days / 30) + " 个月前";
  return Math.floor(days / 365) + " 年前";
}

function repositoryBadge(id, value) {
  return {id:id,badge:{text:value,appearance:{accent:"PLUGIN_ACCENT_GREEN",size:"PLUGIN_COMPONENT_SIZE_COMPACT"}}};
}

function repositoryInfo(id, title, value, accent) {
  return {id:id,card:{appearance:{variant:"PLUGIN_COMPONENT_VARIANT_DARK"},children:[
    profileText(id+"-title",title,"PLUGIN_TEXT_STYLE_CAPTION"),
    profileText(id+"-value",value,"PLUGIN_TEXT_STYLE_TITLE",accent)
  ]}};
}

registerTool("repo_card", function(raw) {
  var input = JSON.parse(raw || "{}");
  var owner = text(input.owner,"owner",100,true), repoName = text(input.repo,"repo",100,true);
  cleanName(owner,"owner"); cleanName(repoName,"repo");
  var query = "query($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){" +
    "name nameWithOwner description url isPrivate stargazerCount forkCount " +
    "issues(states:OPEN){totalCount} pullRequests(states:OPEN){totalCount} watchers{totalCount} " +
    "primaryLanguage{name} licenseInfo{spdxId name} latestRelease{tagName} pushedAt}}";
  var answer = profileGraphQL(query,{owner:owner,repo:repoName});
  if (!answer.ok) return JSON.stringify(answer);
  var repository = answer.data.repository;
  if (!repository) return JSON.stringify({ok:false,error:"未找到仓库，或当前令牌无权访问"});
  try {
    var packageAnswer = profileGraphQL("query($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){" +
      "packageJSON:object(expression:\"HEAD:package.json\"){... on Blob{text isTruncated}}}}",
      {owner:owner,repo:repoName});
    if (packageAnswer.ok && packageAnswer.data.repository) {
      repository.packageJSON = packageAnswer.data.repository.packageJSON;
    }
  } catch (_) { /* Repository metadata is still useful without package.json. */ }
  var parts = repository.nameWithOwner.split("/");
  var canonicalOwner = parts[0] || owner, canonicalRepo = parts[1] || repoName;
  var contributors = repositoryContributorCount(canonicalOwner,canonicalRepo);
  var activity = repositoryHTTP("/repos/" + cleanName(canonicalOwner,"owner") + "/" +
    cleanName(canonicalRepo,"repo") + "/stats/participation");
  var weekly = activity.ok && activity.status === 200 && activity.data &&
    Array.isArray(activity.data.all) ? activity.data.all.slice(-6) : [];
  var points = weekly.map(function(value,index) {
    return {label:index === weekly.length - 1 ? "本周" : "W-" + (weekly.length - index - 1),
      value:Math.max(0,Number(value) || 0)};
  });
  var stack = repositoryTechnology(repository);
  var license = repository.licenseInfo && repository.licenseInfo.spdxId;
  if (!license || license === "NOASSERTION") license = repository.licenseInfo && repository.licenseInfo.name || "未标注";
  var release = repository.latestRelease && repository.latestRelease.tagName || "暂无发布";
  var description = (repository.description || "暂无仓库简介").slice(0,180);
  var header = [profileIcon("repo-icon","chevron.left.forwardslash.chevron.right"),
    {id:"repo-identity",stack:{spacing:2,children:[
      profileText("repo-name",repository.name,"PLUGIN_TEXT_STYLE_TITLE"),
      profileText("repo-owner",canonicalOwner + " · " + (repository.isPrivate ? "private" : "public"),"PLUGIN_TEXT_STYLE_CAPTION")
    ]}},repositoryBadge("repo-brand","GitHub")];
  var children = [
    {id:"repo-header",stack:{axis:"PLUGIN_LAYOUT_AXIS_HORIZONTAL",spacing:8,children:header}},
    {id:"repo-labels",stack:{axis:"PLUGIN_LAYOUT_AXIS_HORIZONTAL",spacing:6,children:[
      repositoryBadge("repo-popular",repository.stargazerCount >= 1000 ? "热门仓库" : "仓库概览"),
      repositoryBadge("repo-visibility",repository.isPrivate ? "私有" : "公开")
    ]}},
    profileText("repo-description",description,"PLUGIN_TEXT_STYLE_CAPTION"),
    {id:"repo-stats",grid:{columns:2,spacing:7,children:[
      profileTile("repo-stars","Stars",profileCount(repository.stargazerCount),"star"),
      profileTile("repo-forks","Forks",profileCount(repository.forkCount),"tuningfork"),
      profileTile("repo-issues","Open Issues",profileCount(repository.issues.totalCount),"exclamationmark.circle"),
      profileTile("repo-pulls","Pull Requests",profileCount(repository.pullRequests.totalCount),"arrow.triangle.pull"),
      profileTile("repo-watchers","Watchers",profileCount(repository.watchers.totalCount),"eye"),
      profileTile("repo-contributors","Contributors",contributors == null ? "暂不可用" : profileCount(contributors),"person.2")
    ]}},
    {id:"repo-meta",grid:{columns:2,spacing:7,children:[
      repositoryInfo("repo-language","主要语言",repository.primaryLanguage && repository.primaryLanguage.name || "未识别"),
      repositoryInfo("repo-license","许可证",license),
      repositoryInfo("repo-release","最新版本",release,"PLUGIN_ACCENT_GREEN"),
      repositoryInfo("repo-updated","最近代码更新",repositoryUpdated(repository.pushedAt),"PLUGIN_ACCENT_GREEN")
    ]}},
    {id:"repo-activity",card:{appearance:{variant:"PLUGIN_COMPONENT_VARIANT_DARK"},children:[
      profileText("repo-activity-title","每周提交活动","PLUGIN_TEXT_STYLE_TITLE")
    ].concat(points.length ? [{id:"repo-activity-chart",chart:{kind:"PLUGIN_CHART_KIND_AREA",height:130,
      points:points,appearance:{accent:"PLUGIN_ACCENT_GREEN"}}}] : [
        profileText("repo-activity-empty",activity.status === 202 ? "GitHub 正在生成统计，请稍后再试" :
          "每周提交统计暂不可用","PLUGIN_TEXT_STYLE_CAPTION")
      ])}}
  ];
  if (stack.length) children.push({id:"repo-stack",card:{appearance:{variant:"PLUGIN_COMPONENT_VARIANT_DARK"},children:[
    profileText("repo-stack-title","技术栈 · 从仓库文件推断","PLUGIN_TEXT_STYLE_TITLE"),
    {id:"repo-stack-tags",grid:{columns:3,spacing:5,children:stack.map(function(name,index) {
      return repositoryBadge("repo-stack-" + index,name);
    })}}
  ]}});
  children.push(profileText("repo-data-note","实时查询快照 · 热门标签为 Stars ≥ 1000","PLUGIN_TEXT_STYLE_CAPTION"));
  var card = {id:"githubrepo" + Date.now().toString(36) + Math.floor(Math.random() * 1000000).toString(36),
    title:"GitHub 仓库概览",components:[{id:"repo-root",card:{appearance:{variant:"PLUGIN_COMPONENT_VARIANT_DARK"},
      onTap:{openURL:repository.url},children:children}}]};
  var shown = JSON.parse(host.ui("show",JSON.stringify(card)));
  return JSON.stringify({shown:shown.ok === true,repository:repository.nameWithOwner,url:repository.url,
    stars:repository.stargazerCount,forks:repository.forkCount,open_issues:repository.issues.totalCount,
    open_pull_requests:repository.pullRequests.totalCount,watchers:repository.watchers.totalCount,
    contributors:contributors,primary_language:repository.primaryLanguage && repository.primaryLanguage.name || null,
    latest_release:repository.latestRelease && repository.latestRelease.tagName || null,
    technologies:stack,weekly_commit_counts:points.map(function(point) { return point.value; }),
    weekly_activity_available:points.length > 0});
});

registerTool("profile_card", function() {
  var firstQuery = "query($cursor:String){viewer{login name avatarUrl(size:128) url followers{totalCount} following{totalCount} " +
    "repositories(first:100,after:$cursor,ownerAffiliations:[OWNER],privacy:PUBLIC){" +
    "totalCount pageInfo{hasNextPage endCursor} nodes{stargazerCount primaryLanguage{name}}} " +
    "contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount contributionLevel}}}}}}";
  var pageQuery = "query($cursor:String){viewer{repositories(first:100,after:$cursor,ownerAffiliations:[OWNER],privacy:PUBLIC){" +
    "totalCount pageInfo{hasNextPage endCursor} nodes{stargazerCount primaryLanguage{name}}}}}";
  var answer = profileGraphQL(firstQuery,{cursor:null});
  if (!answer.ok) return JSON.stringify(answer);
  var viewer = answer.data.viewer;
  if (!viewer || !viewer.login || !viewer.repositories || !viewer.contributionsCollection) {
    return JSON.stringify({ok:false,error:"GitHub 未返回完整的个人概览"});
  }
  var repositories = viewer.repositories;
  var nodes = repositories.nodes || [];
  var page = 1;
  while (repositories.pageInfo && repositories.pageInfo.hasNextPage && page < 10) {
    if (!repositories.pageInfo.endCursor) break;
    answer = profileGraphQL(pageQuery,{cursor:repositories.pageInfo.endCursor});
    if (!answer.ok) return JSON.stringify(answer);
    repositories = answer.data.viewer && answer.data.viewer.repositories;
    if (!repositories) return JSON.stringify({ok:false,error:"GitHub 仓库分页数据不完整"});
    nodes = nodes.concat(repositories.nodes || []);
    page++;
  }
  var complete = !repositories.pageInfo || !repositories.pageInfo.hasNextPage;
  var stars = 0;
  var languages = {};
  nodes.forEach(function(repo) {
    if (!repo) return;
    stars += Number(repo.stargazerCount) || 0;
    if (repo.primaryLanguage && repo.primaryLanguage.name) {
      var name = repo.primaryLanguage.name;
      languages[name] = (languages[name] || 0) + 1;
    }
  });
  var topLanguages = Object.keys(languages).sort(function(a,b) {
    return languages[b] - languages[a] || a.localeCompare(b);
  }).slice(0,4);

  var calendar = viewer.contributionsCollection.contributionCalendar;
  if (!calendar || !calendar.weeks) return JSON.stringify({ok:false,error:"GitHub 未返回贡献日历"});
  var today = new Date();
  var year = today.getUTCFullYear();
  var yearPrefix = String(year) + "-";
  var allDays = [];
  calendar.weeks.forEach(function(week) {
    (week.contributionDays || []).forEach(function(day) {
      if (day && /^\d{4}-\d{2}-\d{2}$/.test(day.date)) allDays.push(day);
    });
  });
  allDays.sort(function(a,b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var byDate = {};
  var yearDays = [];
  var contributions = 0;
  allDays.forEach(function(day) {
    var count = Math.max(0,Number(day.contributionCount) || 0);
    byDate[day.date] = count;
    if (day.date.slice(0,5) === yearPrefix) {
      contributions += count;
      yearDays.push({date:day.date,value:count,level:profileLevel(day.contributionLevel)});
    }
  });
  var streak = 0;
  for (var i=allDays.length-1; i>=0; i--) {
    if (i === allDays.length-1 && !byDate[allDays[i].date]) continue;
    if (!byDate[allDays[i].date]) break;
    streak++;
  }
  var avatar = typeof viewer.avatarUrl === "string" && /^https:\/\//.test(viewer.avatarUrl) ? viewer.avatarUrl : "";
  var headerChildren = [];
  if (avatar) headerChildren.push({id:"profile-avatar",image:{url:avatar,width:64,height:64,
    shape:"PLUGIN_IMAGE_SHAPE_CIRCLE",borderWidth:3,appearance:{accent:"PLUGIN_ACCENT_GREEN"}}});
  headerChildren.push({id:"profile-identity",stack:{spacing:3,children:[
    profileText("profile-name",viewer.name || viewer.login,"PLUGIN_TEXT_STYLE_TITLE"),
    profileText("profile-login","@" + viewer.login,"PLUGIN_TEXT_STYLE_CAPTION")
  ]}});
  headerChildren.push({id:"profile-brand",badge:{text:"GitHub",appearance:{accent:"PLUGIN_ACCENT_GREEN",size:"PLUGIN_COMPONENT_SIZE_COMPACT"}}});
  var children = [
    {id:"profile-header",stack:{axis:"PLUGIN_LAYOUT_AXIS_HORIZONTAL",spacing:12,children:headerChildren}},
    {id:"profile-stats",grid:{columns:2,spacing:7,children:[
      profileTile("stat-repos","公开仓库",profileCount(viewer.repositories.totalCount),"book.closed"),
      profileTile("stat-stars","Stars",profileCount(stars) + (complete ? "" : "+"),"star"),
      profileTile("stat-followers","Followers",profileCount(viewer.followers.totalCount),"person.2"),
      profileTile("stat-following","Following",profileCount(viewer.following.totalCount),"person.badge.plus")
    ]}},
    {id:"profile-contribution-stats",grid:{columns:2,spacing:7,children:[
      profileTile("stat-contributions","今年贡献",profileCount(contributions),"calendar"),
      profileTile("stat-streak","连续贡献",streak + " 天","flame.fill","PLUGIN_ACCENT_GREEN")
    ]}},
    {id:"profile-calendar-card",card:{appearance:{variant:"PLUGIN_COMPONENT_VARIANT_DARK"},children:[
      {id:"profile-calendar",calendarHeatmap:{title:year + " 年贡献活动",startDate:year + "-01-01",
        endDate:year + "-12-31",days:yearDays,appearance:{accent:"PLUGIN_ACCENT_GREEN"}}}
    ]}}
  ];
  if (topLanguages.length) children.push({id:"profile-languages-card",card:{appearance:{variant:"PLUGIN_COMPONENT_VARIANT_DARK"},children:[
    profileText("profile-languages-title","主要语言","PLUGIN_TEXT_STYLE_TITLE"),
    {id:"profile-languages",grid:{columns:4,spacing:5,children:topLanguages.map(function(name,index) {
      return {id:"profile-language-" + index,badge:{text:name,appearance:{accent:"PLUGIN_ACCENT_GREEN",size:"PLUGIN_COMPONENT_SIZE_COMPACT"}}};
    })}}
  ]}});
  children.push(profileText("profile-scope",complete ?
    "公开自有仓库 · 语言按仓库主语言统计" :
    "Stars 与语言仅统计前 1000 个公开自有仓库","PLUGIN_TEXT_STYLE_CAPTION"));
  var card = {id:"github" + Date.now().toString(36) + Math.floor(Math.random() * 1000000).toString(36),
    title:"GitHub 个人概览",components:[
    {id:"profile-root",card:{appearance:{variant:"PLUGIN_COMPONENT_VARIANT_DARK"},children:children}}
  ]};
  var result;
  var legacyUI = false;
  try {
    result = JSON.parse(host.ui("show",JSON.stringify(card)));
  } catch (error) {
    if (String(error).indexOf("invalid Cuebo component content") < 0) throw error;
    legacyUI = true;
    var fallback = [profileText("profile-update","更新 App 可查看全年贡献热力图","PLUGIN_TEXT_STYLE_CAPTION")];
    children.forEach(function(item) {
      if (item.id === "profile-calendar-card") return;
      if (item.id === "profile-header") {
        fallback.push({id:"profile-header",stack:{axis:"PLUGIN_LAYOUT_AXIS_HORIZONTAL",spacing:12,children:
          [profileIcon("profile-avatar-fallback","person.crop.circle")].concat(headerChildren.filter(function(child) {
            return child.id !== "profile-avatar";
          }))}});
      } else {
        fallback.push(item);
      }
    });
    card.components[0].card.children = fallback;
    result = JSON.parse(host.ui("show",JSON.stringify(card)));
  }
  return JSON.stringify({shown:result.ok === true,login:viewer.login,repository_scope:"owned_public",
    repository_stats_complete:complete,contributions_year:year,legacy_ui:legacyUI});
});
