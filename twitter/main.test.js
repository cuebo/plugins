const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const manifest = JSON.parse(fs.readFileSync(__dirname + "/plugin.json", "utf8"));
const functions = {};
const requests = [];
let config = {};
let nextResponse = null;
let networkError = null;
const host = {
  config: () => JSON.stringify(config),
  request: raw => {
    const request = JSON.parse(raw);
    requests.push(request);
    if (networkError) throw new Error(networkError);
    if (nextResponse) {
      const response = nextResponse;
      nextResponse = null;
      return JSON.stringify(response);
    }
    const path = new URL(request.url).pathname;
    let body = {};
    if (path === "/2/status/12345" || path === "/2/thread/12345") {
      body = {code: 200, status: {id: "12345", text: "hello", author: {screen_name: "X", name: "X"}, likes: 2}, thread: [{id: "12345", text: "hello"}]};
    } else if (path === "/2/profile/X") {
      body = {code: 200, user: {id: "7", screen_name: "X", name: "X"}};
    } else if (path === "/2/profile/X/statuses") {
      body = {code: 200, results: [{id: "12345", text: "hello"}], cursor: {bottom: "next"}};
    } else if (path === "/2/trends") {
      body = {code: 200, trends: [{name: "topic", rank: 1}]};
    } else if (path === "/2/users/me") {
      body = {data: {id: "777", username: "owner"}};
    } else if (path === "/2/tweets/search/recent") {
      body = {data: [{id: "12345", text: "hello"}], meta: {next_token: "next"}};
    } else {
      body = {data: {id: "12345"}};
    }
    return JSON.stringify({status: request.method === "POST" ? 201 : 200, body: JSON.stringify(body)});
  },
};
vm.runInNewContext(fs.readFileSync(__dirname + "/main.js", "utf8"), {
  host, registerTool: (name, fn) => { functions[name] = fn; },
  JSON, Number, Object, String, Array, Math, encodeURIComponent,
});
const invoke = (name, args = {}) => JSON.parse(functions[name](JSON.stringify(args)));
const last = () => requests.at(-1);

assert.equal(manifest.tools.length, 16);
assert.deepEqual(manifest.tools.map(t => t.name).sort(), Object.keys(functions).sort());
assert.deepEqual(manifest.networkHosts, ["api.fxtwitter.com", "api.x.com"]);
for (const entry of manifest.tools.slice(8)) assert.equal(entry.requiresApproval, true);
for (const entry of manifest.tools.slice(0, 8)) assert.equal(entry.requiresApproval, undefined);

assert.equal(invoke("get_post", {post_id: "https://x.com/X/status/12345"}).data.id, "12345");
assert.equal(last().url, "https://api.fxtwitter.com/2/status/12345");
assert.equal(last().headers.Authorization, undefined);
assert.equal(invoke("get_thread", {post_id: "12345"}).data.posts.length, 1);
assert.equal(invoke("get_profile", {username: "@X"}).data.username, "X");
assert.equal(invoke("user_timeline", {username: "X", count: 2, cursor: "x+y"}).data.next_cursor, "next");
assert(last().url.includes("cursor=x%2By"));
assert.equal(invoke("trends").data[0].name, "topic");
assert.equal(invoke("get_post", {post_id: "https://evil.example/X/status/12345"}).ok, false);
assert.equal(invoke("get_profile", {username: "../bad"}).ok, false);
assert.equal(invoke("trends", {count: 100}).ok, false);

const beforeAuth = requests.length;
assert.equal(invoke("search_posts", {query: "hello"}).ok, false);
assert.equal(invoke("create_post", {text: "hi"}).ok, false);
assert.equal(requests.length, beforeAuth);

config = {app_bearer_token: "app-secret", user_token: "user-secret"};
assert.equal(invoke("search_posts", {query: "hello world", count: 10}).ok, true);
assert(last().url.includes("query=hello%20world"));
assert.equal(last().headers.Authorization, "Bearer app-secret");
assert.equal(invoke("my_profile").ok, true);
assert.equal(last().headers.Authorization, "Bearer user-secret");
assert.equal(invoke("my_bookmarks", {count: 10}).ok, true);
assert.equal(last().url, "https://api.x.com/2/users/777/bookmarks?max_results=10&tweet.fields=created_at,author_id,public_metrics");

assert.equal(invoke("create_post", {text: "Reply", reply_to_id: "12345"}).ok, true);
assert.equal(last().url, "https://api.x.com/2/tweets");
assert.deepEqual(JSON.parse(last().body), {text: "Reply", reply: {in_reply_to_tweet_id: "12345"}});
assert.equal(invoke("delete_post", {post_id: "12345"}).ok, true);
assert.equal(last().method, "DELETE");
for (const [name, method, suffix] of [
  ["like_post", "POST", "/likes"], ["unlike_post", "DELETE", "/likes/12345"],
  ["bookmark_post", "POST", "/bookmarks"], ["remove_bookmark", "DELETE", "/bookmarks/12345"],
  ["repost_post", "POST", "/retweets"], ["undo_repost", "DELETE", "/retweets/12345"],
]) {
  assert.equal(invoke(name, {post_id: "12345"}).ok, true, name);
  assert.equal(last().method, method, name);
  assert.equal(last().url, "https://api.x.com/2/users/777" + suffix, name);
}
assert.equal(invoke("create_post", {text: " "}).ok, false);
assert.equal(invoke("like_post", {post_id: "123x"}).ok, false);

nextResponse = {status: 402, body: JSON.stringify({detail: "No credits"})};
assert.match(invoke("search_posts", {query: "hi"}).error, /额度不足/);
nextResponse = {status: 401, body: JSON.stringify({detail: "user-secret expired"})};
assert(!JSON.stringify(invoke("my_profile")).includes("user-secret"));
networkError = "Authorization user-secret leaked";
assert(!JSON.stringify(invoke("my_profile")).includes("user-secret"));

console.log("twitter plugin tests passed");
