import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Wally homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /WALLY/);
  assert.match(html, /Today&#x27;s work/);
  assert.match(html, /Five-Task Morning Cut List/);
});

test("renders archived Sunday essays in full", async () => {
  const html = await (await render()).text();

  assert.match(html, /class="sunday-essay"/);
  assert.match(html, /The week I mistook repetition for progress\./);
  assert.match(html, /four tool opens, one check-in start, and one completion were recorded/i);
  assert.match(html, /event counts, not four identified people/i);
  assert.match(html, /reject repeated mental walkthroughs/i);
});
