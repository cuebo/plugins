const NOTION_REDIRECT = "https://oauth.myservers.plus/notion";
const NOTION_AUTHORIZE = "https://api.notion.com/v1/oauth/authorize";
const NOTION_TOKEN = "https://api.notion.com/v1/oauth/token";
const NOTION_VERSION = "2026-03-11";
const MAX_AUTH_AGE_MS = 10 * 60 * 1000;
const LOCAL_REFRESH_SECONDS = 7 * 24 * 60 * 60;

function noStore(extra = {}) {
  return {"Cache-Control":"no-store", "Referrer-Policy":"no-referrer", ...extra};
}

function failure(status, message) {
  return new Response(message, {status, headers:noStore()});
}

function encode(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 4096) throw new Error("Invalid signed value");
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function signingKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    {name:"HMAC", hash:"SHA-256"}, false, ["sign", "verify"]);
}

async function signObject(value, secret) {
  const payload = encode(new TextEncoder().encode(JSON.stringify(value)));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), new TextEncoder().encode(payload));
  return payload + "." + encode(new Uint8Array(signature));
}

async function readSigned(value, secret) {
  if (typeof value !== "string" || value.length > 4096) throw new Error("Invalid signed value");
  const parts = value.split(".");
  if (parts.length !== 2) throw new Error("Invalid signed value");
  const valid = await crypto.subtle.verify("HMAC", await signingKey(secret), decode(parts[1]),
    new TextEncoder().encode(parts[0]));
  if (!valid) throw new Error("Invalid signature");
  const result = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  if (!result || result.v !== 1 || !Number.isFinite(result.t) ||
      result.t > Date.now() + 30_000 || Date.now() - result.t > MAX_AUTH_AGE_MS) {
    throw new Error("Expired signed value");
  }
  return result;
}

async function sha256Challenge(verifier) {
  return encode(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

function notionConfigured(env) {
  return typeof env?.NOTION_CLIENT_ID === "string" && !!env.NOTION_CLIENT_ID &&
    typeof env?.NOTION_CLIENT_SECRET === "string" && !!env.NOTION_CLIENT_SECRET;
}

async function notionAuthorize(url, env) {
  const query = url.searchParams;
  const state = query.get("state");
  const challenge = query.get("code_challenge");
  if (query.get("client_id") !== env.NOTION_CLIENT_ID ||
      query.get("redirect_uri") !== NOTION_REDIRECT || query.get("response_type") !== "code" ||
      query.get("code_challenge_method") !== "S256" ||
      !state || !/^[A-Za-z0-9_-]{20,150}$/.test(state) ||
      !challenge || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return failure(400, "Invalid Notion authorization request");
  const signedState = await signObject({v:1, t:Date.now(), s:state, h:challenge}, env.NOTION_CLIENT_SECRET);
  const target = new URL(NOTION_AUTHORIZE);
  target.searchParams.set("owner", "user");
  target.searchParams.set("client_id", env.NOTION_CLIENT_ID);
  target.searchParams.set("redirect_uri", NOTION_REDIRECT);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("state", signedState);
  return new Response(null, {status:302, headers:noStore({Location:target.toString()})});
}

async function notionCallback(url, env) {
  let state;
  try { state = await readSigned(url.searchParams.get("state"), env.NOTION_CLIENT_SECRET); }
  catch (_) { return failure(400, "Invalid Notion authorization state"); }
  if (!state.s || !state.h) return failure(400, "Invalid Notion authorization state");
  const callback = new URL("cuebo://plugin-auth/notion");
  callback.searchParams.set("state", state.s);
  const error = url.searchParams.get("error");
  if (error) {
    callback.searchParams.set("error", /^[a-z_]{1,50}$/.test(error) ? error : "authorization_failed");
  } else {
    const code = url.searchParams.get("code");
    if (!code || code.length > 1000) return failure(400, "Missing Notion authorization code");
    callback.searchParams.set("code", await signObject({v:1, t:Date.now(), c:code, h:state.h}, env.NOTION_CLIENT_SECRET));
  }
  return new Response(null, {status:302, headers:noStore({Location:callback.toString()})});
}

async function notionToken(request, env) {
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) {
    return failure(415, "Unsupported content type");
  }
  const raw = await request.text();
  if (raw.length > 8192) return failure(413, "Request too large");
  const input = new URLSearchParams(raw);
  if (input.get("client_id") !== env.NOTION_CLIENT_ID) return failure(400, "Invalid client");
  const grant = input.get("grant_type");
  let body;
  if (grant === "authorization_code") {
    if (input.get("redirect_uri") !== NOTION_REDIRECT) return failure(400, "Invalid redirect");
    const verifier = input.get("code_verifier");
    if (!verifier || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return failure(400, "Invalid verifier");
    let ticket;
    try { ticket = await readSigned(input.get("code"), env.NOTION_CLIENT_SECRET); }
    catch (_) { return failure(400, "Invalid authorization code"); }
    if (!ticket.c || ticket.h !== await sha256Challenge(verifier)) return failure(400, "Invalid verifier");
    body = {grant_type:"authorization_code", code:ticket.c, redirect_uri:NOTION_REDIRECT};
  } else if (grant === "refresh_token") {
    const refreshToken = input.get("refresh_token");
    if (!refreshToken || refreshToken.length > 2000) return failure(400, "Invalid refresh token");
    body = {grant_type:"refresh_token", refresh_token:refreshToken};
  } else return failure(400, "Unsupported grant");
  let upstream;
  try {
    upstream = await fetch(NOTION_TOKEN, {method:"POST", headers:{
      "Authorization":"Basic " + btoa(env.NOTION_CLIENT_ID + ":" + env.NOTION_CLIENT_SECRET),
      "Content-Type":"application/json", "Accept":"application/json", "Notion-Version":NOTION_VERSION
    }, body:JSON.stringify(body)});
  } catch (_) { return failure(502, "Notion token service unavailable"); }
  if (!upstream.ok) return failure(502, "Notion token exchange failed");
  let data;
  try { data = await upstream.json(); }
  catch (_) { return failure(502, "Invalid Notion token response"); }
  if (!data || typeof data.access_token !== "string" || !data.access_token ||
      typeof data.refresh_token !== "string" || !data.refresh_token) {
    return failure(502, "Invalid Notion token response");
  }
  // Notion does not document expires_in. This tells Cuebo when to proactively refresh.
  return new Response(JSON.stringify({access_token:data.access_token,
    refresh_token:data.refresh_token, expires_in:LOCAL_REFRESH_SECONDS}),
    {status:200, headers:noStore({"Content-Type":"application/json; charset=utf-8"})});
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/" && !url.search) {
      return new Response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cuebo 授权连接</title><style>body{font:16px -apple-system,BlinkMacSystemFont,sans-serif;max-width:38rem;margin:12vh auto;padding:0 24px;line-height:1.7;color:#222}a{color:#1769d2}</style><h1>Cuebo</h1><p>此页面用于将第三方服务的授权结果安全交回 Cuebo App。</p><p><a href="https://github.com/cuebo/plugins">查看 Cuebo 插件</a></p></html>', {
        headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"},
      });
    }
    if (url.pathname === "/notion/authorize" || url.pathname === "/notion" || url.pathname === "/notion/token") {
      if (!notionConfigured(env)) return failure(503, "Notion authorization is not configured");
      if (request.method === "GET" && url.pathname === "/notion/authorize") return notionAuthorize(url, env);
      if (request.method === "GET" && url.pathname === "/notion") return notionCallback(url, env);
      if (request.method === "POST" && url.pathname === "/notion/token") return notionToken(request, env);
      return failure(405, "Method not allowed");
    }
    const provider = url.pathname.slice(1);
    if (request.method !== "GET" || !/^[a-z][a-z0-9_-]{0,49}$/.test(provider) ||
        !url.searchParams.get("state") ||
        (!url.searchParams.get("code") && !url.searchParams.get("error"))) {
      return new Response("Invalid OAuth callback", {status: 400, headers: {"Cache-Control": "no-store"}});
    }
    const callback = new URL("cuebo://plugin-auth/" + provider);
    for (const key of ["code", "state", "error", "error_description"]) {
      const value = url.searchParams.get(key);
      if (value) callback.searchParams.set(key, value);
    }
    return new Response(null, {status: 302, headers: {
      "Location": callback.toString(),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    }});
  },
};
