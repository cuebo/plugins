const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const script = fs.readFileSync(__dirname + "/main.js", "utf8");

function run(options = {}) {
  const calls = [];
  const shown = [];
  const tools = {};
  const repository = options.repository === undefined ? {
    name: "awesome-ui-kit", nameWithOwner: "openui-labs/awesome-ui-kit",
    description: "Open-source UI components", url: "https://github.com/openui-labs/awesome-ui-kit",
    isPrivate: false, stargazerCount: options.lowStars ? 42 : 8400, forkCount: 1200,
    issues: {totalCount: 48}, pullRequests: {totalCount: 16}, watchers: {totalCount: 620},
    primaryLanguage: {name: "TypeScript"}, licenseInfo: {spdxId: "MIT", name: "MIT License"},
    latestRelease: {tagName: "v2.3.1"}, branches: {totalCount: 3}, tags: {totalCount: 12},
    pushedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    packageJSON: options.noPackage ? null : {isTruncated: false, text: JSON.stringify({
      dependencies: {react: "*"}, devDependencies: {vite: "*", tailwindcss: "*", "@storybook/react": "*"},
    })},
  } : options.repository;
  const host = {
    config: () => JSON.stringify({token: options.noToken ? "" : "test-token"}),
    request: raw => {
      const request = JSON.parse(raw);
      calls.push(request);
      if (options.oauthUnavailable && request.auth === "oauth") throw new Error("请先连接插件账号，或重新授权");
      if (options.authRejected) return JSON.stringify({status: 401, body: JSON.stringify({message: "Bad credentials"})});
      if (request.url.includes("/user/repos?")) return JSON.stringify({status: 200, body: "[]"});
      if (request.url.endsWith("/graphql")) {
        assert.strictEqual(request.method, "POST");
        const body = JSON.parse(request.body);
        assert.strictEqual(body.variables.owner, "openui-labs");
        assert.strictEqual(body.variables.repo, "awesome-ui-kit");
        if (body.query.includes("packageJSON")) {
          if (options.packageForbidden) {
            return JSON.stringify({status: 403, body: JSON.stringify({message: "Forbidden"})});
          }
          const data = {repository: {packageJSON: repository && repository.packageJSON}};
          return JSON.stringify({status: 200, body: JSON.stringify({data})});
        }
        assert(body.query.includes("latestRelease"));
        const summary = repository && {...repository};
        if (summary) delete summary.packageJSON;
        return JSON.stringify({status: 200, body: JSON.stringify({data: {repository: summary}})});
      }
      if (request.url.includes("/contributors?")) {
        return JSON.stringify(options.noContributors ? {status: 403, body: JSON.stringify({message: "Forbidden"})} : {
          status: 200, body: JSON.stringify([{login: "person"}]),
          link: '<https://api.github.com/repos/openui-labs/awesome-ui-kit/contributors?page=94&per_page=1&anon=true>; rel="last"',
        });
      }
      if (request.url.endsWith("/stats/participation")) {
        return JSON.stringify(options.pendingActivity ? {status: 202, body: ""} : {
          status: 200, body: JSON.stringify({all: Array(46).fill(0).concat([105, 175, 230, 225, 300, 350])}),
        });
      }
      if (request.url.endsWith("/stats/commit_activity")) {
        const firstSunday = new Date();
        firstSunday.setUTCHours(0, 0, 0, 0);
        firstSunday.setUTCDate(firstSunday.getUTCDate() - firstSunday.getUTCDay() - 51 * 7);
        const sunday = firstSunday.getTime() / 1000;
        return JSON.stringify(options.pendingActivity ? {status: 202, body: ""} : {
          status: 200, body: JSON.stringify(Array.from({length: 52}, (_, index) => ({
            week: sunday + index * 604800, days: [0, 1, 2, 3, 4, 5, 6], total: 21,
          }))),
        });
      }
      throw new Error("unexpected request: " + request.url);
    },
    ui: (action, raw) => {
      assert.strictEqual(action, "show");
      shown.push(JSON.parse(raw));
      return JSON.stringify({ok: true});
    },
  };
  vm.runInNewContext(script, {host, registerTool: (name, handler) => { tools[name] = handler; },
    JSON, Date, Math, Number, Object, String, isFinite});
  return {calls, shown, tools};
}

function flatten(children, output = []) {
  for (const node of children || []) {
    output.push(node);
    const content = Object.keys(node).filter(key => key !== "id").map(key => node[key])[0];
    if (content && content.children) flatten(content.children, output);
  }
  return output;
}

const success = run();
const result = JSON.parse(success.tools.repo_card(JSON.stringify({owner: "openui-labs", repo: "awesome-ui-kit"})));
assert.strictEqual(result.shown, true, JSON.stringify(result));
assert.strictEqual(result.repository, "openui-labs/awesome-ui-kit");
assert.strictEqual(result.weekly_activity_available, true);
assert.strictEqual(success.calls.length, 5);
assert.strictEqual(result.stars, 8400);
assert.strictEqual(result.open_issues, 48);
assert.strictEqual(result.contributors, 94);
assert.strictEqual(success.shown.length, 1);
assert(JSON.stringify(success.shown[0]).length < 64000);
const root = success.shown[0].components[0].card;
assert.strictEqual(root.onTap.openURL, "https://github.com/openui-labs/awesome-ui-kit");
const nodes = flatten(success.shown[0].components);
assert.strictEqual(new Set(nodes.map(node => node.id)).size, nodes.length);
assert.strictEqual(nodes.find(node => node.id === "repo-meta").grid.columns, 2);
assert.strictEqual(nodes.find(node => node.id === "repo-activity-heatmap").calendarHeatmap.days.length, 364);
assert.strictEqual(result.commits_last_year, 1092);
assert(nodes.some(node => node.text && node.text.text === "3 分支"));
assert(nodes.some(node => node.text && node.text.text === "12 标签"));
assert(nodes.some(node => node.badge && node.badge.text === "★ 8.4k"));
assert(!nodes.some(node => node.chart));

const partial = run({pendingActivity: true, noContributors: true, noPackage: true, lowStars: true});
const partialResult = JSON.parse(partial.tools.repo_card(JSON.stringify({owner: "openui-labs", repo: "awesome-ui-kit"})));
assert.strictEqual(partialResult.shown, true);
assert.strictEqual(partialResult.contributors, null);
assert.strictEqual(partialResult.weekly_activity_available, false);
const partialNodes = flatten(partial.shown[0].components);
assert(!partialNodes.some(node => node.calendarHeatmap));
assert(partialNodes.some(node => node.text && node.text.text.includes("正在生成统计")));
assert.strictEqual(partialResult.commits_last_year, null);

const packageDenied = run({packageForbidden: true});
const packageDeniedResult = JSON.parse(packageDenied.tools.repo_card(JSON.stringify({
  owner: "openui-labs", repo: "awesome-ui-kit",
})));
assert.strictEqual(packageDeniedResult.shown, true);
assert.strictEqual(packageDeniedResult.technologies.length, 1);

const missing = run({repository: null});
assert.strictEqual(JSON.parse(missing.tools.repo_card(JSON.stringify({owner: "openui-labs", repo: "awesome-ui-kit"}))).ok, false);
assert.strictEqual(missing.shown.length, 0);
const noToken = run({noToken: true});
assert.strictEqual(JSON.parse(noToken.tools.repo_card(JSON.stringify({owner: "openui-labs", repo: "awesome-ui-kit"}))).shown, true);
assert(noToken.calls.length > 0);
assert(noToken.calls.every(request => request.auth === "oauth" && !request.headers.Authorization));
assert(success.calls.every(request => request.auth === "oauth" && !request.headers.Authorization));
const fallback = run({oauthUnavailable: true});
assert.strictEqual(JSON.parse(fallback.tools.repos("{}") ).ok, true);
assert.strictEqual(fallback.calls[0].auth, "oauth");
assert.strictEqual(fallback.calls[1].headers.Authorization, "Bearer test-token");
const rejected = run({authRejected: true});
assert.match(JSON.parse(rejected.tools.repos("{}")).error, /重新连接 GitHub/);
const manualRejected = run({oauthUnavailable: true, authRejected: true});
assert.match(JSON.parse(manualRejected.tools.repos("{}")).error, /手动访问令牌无效/);
assert.throws(() => success.tools.repo_card(JSON.stringify({owner: "../bad", repo: "x"})), /无效/);

if (process.env.CUEBO_CARD_SAMPLE) {
  fs.writeFileSync(process.env.CUEBO_CARD_SAMPLE, JSON.stringify({
    type: "cuebo", title: success.shown[0].title, components: success.shown[0].components,
  }));
}
console.log("github repository card mock passed");
