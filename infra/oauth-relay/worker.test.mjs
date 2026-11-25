import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";

const source = await readFile(new URL("./worker.js", import.meta.url), "utf8");
const {default: worker} = await import(`data:text/javascript,${encodeURIComponent(source)}`);
const home = await worker.fetch(new Request("https://oauth.myservers.plus/"));
assert.equal(home.status, 200);
assert.match(await home.text(), /Cuebo/);
const callback = await worker.fetch(new Request("https://oauth.myservers.plus/cloudflare?code=a%2Bb&state=nonce&extra=secret"));
assert.equal(callback.status, 302);
assert.equal(callback.headers.get("cache-control"), "no-store");
assert.equal(callback.headers.get("referrer-policy"), "no-referrer");
assert.equal(callback.headers.get("location"), "cuebo://plugin-auth/cloudflare?code=a%2Bb&state=nonce");
for (const path of ["/../cloudflare", "/cloudflare?code=x", "/cloudflare?state=x"]) {
  assert.equal((await worker.fetch(new Request(`https://oauth.myservers.plus${path}`))).status, 400);
}
const env = {NOTION_CLIENT_ID:"client-id", NOTION_CLIENT_SECRET:"test-secret"};
const verifier = "v".repeat(64);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const authorize = new URL("https://oauth.myservers.plus/notion/authorize");
authorize.searchParams.set("client_id", env.NOTION_CLIENT_ID);
authorize.searchParams.set("redirect_uri", "https://oauth.myservers.plus/notion");
authorize.searchParams.set("response_type", "code");
authorize.searchParams.set("state", "s".repeat(43));
authorize.searchParams.set("code_challenge", challenge);
authorize.searchParams.set("code_challenge_method", "S256");
assert.equal((await worker.fetch(new Request(authorize))).status, 503);
const start = await worker.fetch(new Request(authorize), env);
assert.equal(start.status, 302);
const notionURL = new URL(start.headers.get("location"));
assert.equal(notionURL.origin, "https://api.notion.com");
assert.equal(notionURL.searchParams.get("owner"), "user");
assert.notEqual(notionURL.searchParams.get("state"), "s".repeat(43));
const badCallback = await worker.fetch(new Request("https://oauth.myservers.plus/notion?code=abc&state=bad"), env);
assert.equal(badCallback.status, 400);
const callbackURL = new URL("https://oauth.myservers.plus/notion");
callbackURL.searchParams.set("code", "one-time-notion-code");
callbackURL.searchParams.set("state", notionURL.searchParams.get("state"));
const returned = await worker.fetch(new Request(callbackURL), env);
assert.equal(returned.status, 302);
const appCallback = new URL(returned.headers.get("location"));
assert.equal(appCallback.origin, "null");
assert.equal(appCallback.searchParams.get("state"), "s".repeat(43));
const ticket = appCallback.searchParams.get("code");
let tokenCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  tokenCalls++;
  assert.equal(url, "https://api.notion.com/v1/oauth/token");
  assert.equal(options.headers["Notion-Version"], "2026-03-11");
  assert.equal(options.headers.Authorization, "Basic " + Buffer.from("client-id:test-secret").toString("base64"));
  const body = JSON.parse(options.body);
  if (body.grant_type === "authorization_code") {
    assert.equal(body.code, "one-time-notion-code");
    assert.equal(body.redirect_uri, "https://oauth.myservers.plus/notion");
  } else assert.equal(body.refresh_token, "refresh-one");
  return new Response(JSON.stringify({access_token:"access-two", refresh_token:"refresh-two"}),
    {status:200, headers:{"content-type":"application/json"}});
};
try {
  const form = new URLSearchParams({client_id:"client-id", grant_type:"authorization_code", code:ticket,
    code_verifier:verifier, redirect_uri:"https://oauth.myservers.plus/notion"});
  const tokenRequest = () => new Request("https://oauth.myservers.plus/notion/token",
    {method:"POST", headers:{"content-type":"application/x-www-form-urlencoded"}, body:form.toString()});
  const exchanged = await worker.fetch(tokenRequest(), env);
  assert.equal(exchanged.status, 200);
  assert.deepEqual(await exchanged.json(), {access_token:"access-two", refresh_token:"refresh-two", expires_in:604800});
  form.set("code_verifier", "x".repeat(64));
  assert.equal((await worker.fetch(tokenRequest(), env)).status, 400);
  assert.equal(tokenCalls, 1);
  const refreshed = await worker.fetch(new Request("https://oauth.myservers.plus/notion/token",
    {method:"POST", headers:{"content-type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({client_id:"client-id", grant_type:"refresh_token", refresh_token:"refresh-one"})}), env);
  assert.equal(refreshed.status, 200);
  assert.equal(tokenCalls, 2);
} finally { globalThis.fetch = originalFetch; }
console.log("OAuth relay tests passed");
