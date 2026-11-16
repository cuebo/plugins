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
      body.message || "GitHub 个人数据查询失败"};
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

function profileDateUTC(date) { return date.toISOString().slice(0,10); }

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
  var activity = [];
  for (var offset=29; offset>=0; offset--) {
    var date = new Date(Date.UTC(year,today.getUTCMonth(),today.getUTCDate()-offset));
    var key = profileDateUTC(date);
    activity.push({label:key.slice(5),value:byDate[key] || 0});
  }

  var avatar = typeof viewer.avatarUrl === "string" && /^https:\/\//.test(viewer.avatarUrl) ? viewer.avatarUrl : "";
  var headerChildren = [];
  if (avatar) headerChildren.push({id:"profile-avatar",image:{url:avatar,width:64,height:64,
    shape:"PLUGIN_IMAGE_SHAPE_CIRCLE",borderWidth:3,appearance:{accent:"PLUGIN_ACCENT_GREEN"}}});
  headerChildren.push({id:"profile-identity",stack:{spacing:3,children:[
    profileText("profile-name",viewer.name || viewer.login,"PLUGIN_TEXT_STYLE_TITLE"),
    profileText("profile-login","@" + viewer.login,"PLUGIN_TEXT_STYLE_CAPTION"),
    {id:"profile-brand",badge:{text:"GitHub",appearance:{accent:"PLUGIN_ACCENT_GREEN",size:"PLUGIN_COMPONENT_SIZE_COMPACT"}}}
  ]}});
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
    ]}},
    {id:"profile-activity-card",card:{appearance:{variant:"PLUGIN_COMPONENT_VARIANT_DARK"},children:[
      profileText("profile-activity-title","近 30 天活动","PLUGIN_TEXT_STYLE_TITLE"),
      {id:"profile-activity",chart:{kind:"PLUGIN_CHART_KIND_AREA",height:105,points:activity,appearance:{accent:"PLUGIN_ACCENT_GREEN"}}}
    ]}}
  ];
  if (topLanguages.length) children.push({id:"profile-languages-card",card:{appearance:{variant:"PLUGIN_COMPONENT_VARIANT_DARK"},children:[
    profileText("profile-languages-title","主要语言","PLUGIN_TEXT_STYLE_TITLE"),
    {id:"profile-languages",grid:{columns:2,spacing:5,children:topLanguages.map(function(name,index) {
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
        fallback.push({id:"profile-header",stack:{axis:"PLUGIN_LAYOUT_AXIS_HORIZONTAL",spacing:12,children:[
          profileIcon("profile-avatar-fallback","person.crop.circle"),
          headerChildren[headerChildren.length - 1]
        ]}});
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
