export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/" && !url.search) {
      return new Response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cuebo 授权连接</title><style>body{font:16px -apple-system,BlinkMacSystemFont,sans-serif;max-width:38rem;margin:12vh auto;padding:0 24px;line-height:1.7;color:#222}a{color:#1769d2}</style><h1>Cuebo</h1><p>此页面用于将第三方服务的授权结果安全交回 Cuebo App。</p><p><a href="https://github.com/cuebo/plugins">查看 Cuebo 插件</a></p></html>', {
        headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store"},
      });
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
