import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

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
console.log("OAuth relay tests passed");
