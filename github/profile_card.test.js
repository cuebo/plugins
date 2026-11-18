const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const tools = {};
let shownCard;
let requests = 0;
let rejectNewComponent = false;
const today = new Date();
const days = [];
for (let offset = 370; offset >= 0; offset--) {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset));
  days.push({
    date: date.toISOString().slice(0, 10),
    contributionCount: offset < 2 ? 3 : offset % 9 === 0 ? 1 : 0,
    contributionLevel: offset < 2 ? "FOURTH_QUARTILE" : offset % 9 === 0 ? "FIRST_QUARTILE" : "NONE",
  });
}
const firstRepositories = Array.from({length: 100}, (_, index) => ({
  stargazerCount: 1,
  primaryLanguage: {name: index < 70 ? "Python" : index < 90 ? "TypeScript" : "Rust"},
}));
const secondRepositories = Array.from({length: 28}, () => ({
  stargazerCount: 2,
  primaryLanguage: {name: "Go"},
}));
const host = {
  config: () => JSON.stringify({token: "test-token"}),
  request: raw => {
    const request = JSON.parse(raw);
    if (request.method === "GET") {
      return JSON.stringify({status: 200, body: JSON.stringify([{name: "example", stargazers_count: 5}])});
    }
    assert.strictEqual(request.url, "https://api.github.com/graphql");
    const body = JSON.parse(request.body);
    requests++;
    if (!body.variables.cursor) {
      assert(body.query.includes("bio location"));
      return JSON.stringify({status: 200, body: JSON.stringify({data: {viewer: {
        login: "devuser", name: "Developer Name",
        bio: "Building useful tools", location: "Shanghai, China", url: "https://github.com/devuser",
        avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
        followers: {totalCount: 860}, following: {totalCount: 120},
        repositories: {
          totalCount: 128,
          pageInfo: {hasNextPage: true, endCursor: "next"},
          nodes: firstRepositories,
        },
        contributionsCollection: {
          contributionCalendar: {weeks: [{contributionDays: days}]},
        },
      }}})});
    }
    assert.strictEqual(body.variables.cursor, "next");
    return JSON.stringify({status: 200, body: JSON.stringify({data: {viewer: {
      repositories: {
        totalCount: 128,
        pageInfo: {hasNextPage: false, endCursor: null},
        nodes: secondRepositories,
      },
    }}})});
  },
  ui: (action, raw) => {
    assert.strictEqual(action, "show");
    if (rejectNewComponent) {
      rejectNewComponent = false;
      throw new Error("invalid Cuebo component content");
    }
    shownCard = JSON.parse(raw);
    return JSON.stringify({ok: true});
  },
};
vm.runInNewContext(fs.readFileSync(__dirname + "/main.js", "utf8"), {
  host,
  registerTool: (name, run) => { tools[name] = run; },
  JSON, Date, Math, Number, Object, String, isFinite,
});
const result = JSON.parse(tools.profile_card("{}"));
assert.deepStrictEqual(
  {shown: result.shown, login: result.login, complete: result.repository_stats_complete},
  {shown: true, login: "devuser", complete: true},
);
assert.strictEqual(requests, 2);
assert(JSON.stringify(shownCard).length < 64000);
const root = shownCard.components[0].card;
const nodes = [];
function collect(children) {
  for (const node of children || []) {
    nodes.push(node);
    const component = Object.values(node).find(value => value && typeof value === "object" && !Array.isArray(value));
    if (component && component.children) collect(component.children);
  }
}
collect(shownCard.components);
assert.strictEqual(new Set(nodes.map(node => node.id)).size, nodes.length);
assert(nodes.some(node => node.image && node.image.shape === "PLUGIN_IMAGE_SHAPE_CIRCLE"));
const heatmap = nodes.find(node => node.calendarHeatmap);
assert(heatmap && heatmap.calendarHeatmap.days.length > 300);
assert(nodes.some(node => node.text && node.text.text === "156"));
assert(!nodes.some(node => node.chart));
const header = nodes.find(node => node.id === "profile-header").stack.children;
assert.deepStrictEqual(header.map(node => node.id), ["profile-avatar", "profile-identity"]);
assert.deepStrictEqual(header[1].stack.children.map(node => node.id), ["profile-login", "profile-name"]);
assert(nodes.some(node => node.id === "profile-bio" && node.text.text === "Building useful tools"));
assert(nodes.some(node => node.id === "profile-location-text" && node.text.text === "Shanghai, China"));
assert(nodes.some(node => node.id === "profile-link-text" && node.text.text === "github.com/devuser"));
const stats = nodes.find(node => node.id === "profile-stats").grid;
assert.strictEqual(stats.columns, 3);
assert.strictEqual(stats.children.length, 6);
const languageGrid = nodes.find(node => node.id === "profile-language-grid").grid;
assert.strictEqual(languageGrid.columns, 2);
assert.strictEqual(languageGrid.children.length, 4);
assert(root.children.some(node => node.id === "profile-languages"));
assert(JSON.parse(tools.repos("{}")).ok);
if (process.env.CUEBO_CARD_SAMPLE) {
  fs.writeFileSync(process.env.CUEBO_CARD_SAMPLE, JSON.stringify({
    type: "cuebo", title: shownCard.title, components: shownCard.components,
  }));
}
rejectNewComponent = true;
const fallback = JSON.parse(tools.profile_card("{}"));
assert.strictEqual(fallback.legacy_ui, true);
assert.strictEqual(fallback.shown, true);
assert(!JSON.stringify(shownCard).includes("calendarHeatmap"));
assert(JSON.stringify(shownCard).includes("更新 App"));
console.log("github profile card mock passed");
