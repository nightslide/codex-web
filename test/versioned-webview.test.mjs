import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { gzipSync, gunzipSync } from "node:zlib";
import Fastify from "fastify";
import { publishWebview, ASSET_PREFIX } from "../scripts/publish-webview.mjs";
import {
  registerVersionedWebview,
  registerWebview,
} from "../src/server/webview-assets.ts";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-versioned-assets-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const webview = path.join(root, "webview");
  await mkdir(path.join(webview, "assets"), { recursive: true });
  await writeFile(
    path.join(webview, "index.html"),
    '<script src="./assets/app.js"></script><link href="/assets/style.css"><a href="/manifest.json">manifest</a>',
  );
  await writeFile(
    path.join(webview, "assets", "app.js"),
    'import "./shared.js"; console.log("first");',
  );
  await writeFile(
    path.join(webview, "assets", "shared.js"),
    "export const shared = true;",
  );
  await writeFile(
    path.join(webview, "assets", "style.css"),
    "body { color: white; }",
  );
  await writeFile(
    path.join(webview, "assets", "app.js.gz"),
    gzipSync(await readFile(path.join(webview, "assets", "app.js"))),
  );
  return webview;
}

test("same-name patches get new URLs while old tabs retain original bytes", async (t) => {
  const webview = await fixture(t);
  const first = await publishWebview(webview);
  const repeated = await publishWebview(webview);
  assert.equal(first.revision, repeated.revision);
  const original = await readFile(
    path.join(first.releaseRoot, "assets/app.js"),
    "utf8",
  );
  // Simulate the build writing in place to an existing upstream hashed filename.
  await writeFile(
    path.join(webview, "assets/app.js"),
    'console.log("second");',
  );
  await writeFile(
    path.join(webview, "assets/app.js.gz"),
    gzipSync('console.log("second");'),
  );
  const second = await publishWebview(webview);
  assert.notEqual(second.revision, first.revision);
  assert.equal(
    await readFile(path.join(first.releaseRoot, "assets/app.js"), "utf8"),
    original,
  );
  assert.equal(
    await readFile(path.join(second.releaseRoot, "assets/app.js"), "utf8"),
    'console.log("second");',
  );
  assert.equal(
    (await stat(path.join(first.releaseRoot, "assets/shared.js"))).ino,
    (await stat(path.join(second.releaseRoot, "assets/shared.js"))).ino,
  );
  assert.notEqual(
    (await stat(path.join(webview, "assets/shared.js"))).ino,
    (await stat(path.join(first.releaseRoot, "assets/shared.js"))).ino,
  );
  const html = await readFile(
    path.join(second.releaseRoot, "index.html"),
    "utf8",
  );
  assert.ok(
    html.includes(`src="${ASSET_PREFIX}${second.revision}/assets/app.js"`),
  );
  assert.ok(
    html.includes(`href="${ASSET_PREFIX}${second.revision}/assets/style.css"`),
  );
  assert.ok(html.includes('href="/manifest.json"'));
});

test("versioned assets serve gzip and immutable caching, with retained older releases", async (t) => {
  const webview = await fixture(t);
  const release = await publishWebview(webview);
  const app = Fastify();
  t.after(() => app.close());
  await registerWebview(app, webview);
  const url = `${ASSET_PREFIX}${release.revision}/assets/app.js`;
  const plain = await app.inject(url);
  assert.equal(plain.statusCode, 200);
  assert.match(plain.headers["cache-control"], /max-age=31536000/);
  assert.match(plain.headers["cache-control"], /immutable/);
  const compressed = await app.inject({
    url,
    headers: { "accept-encoding": "gzip" },
  });
  assert.equal(compressed.headers["content-encoding"], "gzip");
  assert.equal(compressed.headers.vary, "Accept-Encoding");
  assert.equal(gunzipSync(compressed.rawPayload).toString(), plain.body);
  const conditional = await app.inject({
    url,
    headers: { "if-none-match": plain.headers.etag },
  });
  assert.equal(conditional.statusCode, 304);
  assert.equal((await app.inject("/")).headers["cache-control"], "no-cache");
  assert.equal(
    (await app.inject("/thread/example")).headers["cache-control"],
    "no-cache",
  );
  assert.equal((await app.inject("/assets/missing.js")).statusCode, 404);
  assert.equal(
    (await app.inject(`${ASSET_PREFIX}${release.revision}/assets/missing.js`))
      .statusCode,
    404,
  );
});

test("packaged builds serve legacy assets without mutable build inputs", async (t) => {
  const webview = await fixture(t);
  await publishWebview(webview);
  await rm(path.join(webview, "assets"), { recursive: true });
  const app = Fastify();
  t.after(() => app.close());
  await registerWebview(app, webview);
  const response = await app.inject("/assets/app.js");
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /console.log\("first"\)/);
  assert.doesNotMatch(response.headers["cache-control"], /immutable/);
  assert.equal((await app.inject("/")).statusCode, 200);
});

test("unpublished development builds fall back; invalid published manifests fail clearly", async (t) => {
  const webview = await fixture(t);
  const app = Fastify();
  t.after(() => app.close());
  assert.equal(await registerVersionedWebview(app, webview), null);
  const buildRoot = path.resolve(webview, "../webview-builds");
  await mkdir(buildRoot);
  await writeFile(
    path.join(buildRoot, "current.json"),
    JSON.stringify({ version: 1, revision: "../../outside" }),
  );
  await assert.rejects(
    registerVersionedWebview(app, webview),
    /Invalid browser asset release manifest/,
  );
});
