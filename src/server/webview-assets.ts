import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";

export const ASSET_PREFIX = "/__codex_assets/";

export async function registerVersionedWebview(
  app: FastifyInstance,
  webviewRoot: string,
): Promise<{ html: string; root: string } | null> {
  const buildRoot = path.resolve(webviewRoot, "../webview-builds");
  let current;
  try {
    current = JSON.parse(
      await fs.readFile(path.join(buildRoot, "current.json"), "utf8"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  if (
    current.version !== 1 ||
    typeof current.revision !== "string" ||
    !/^[a-f0-9]{64}$/.test(current.revision)
  ) {
    throw new Error("Invalid browser asset release manifest");
  }
  const root = path.join(buildRoot, "releases", current.revision);
  const html = await fs.readFile(path.join(root, "index.html"), "utf8");
  await app.register(fastifyStatic, {
    root: path.join(buildRoot, "releases"),
    prefix: ASSET_PREFIX,
    decorateReply: false,
    index: false,
    preCompressed: true,
    maxAge: "1y",
    immutable: true,
    setHeaders(response) {
      response.setHeader("Vary", "Accept-Encoding");
    },
  });
  return { html, root };
}

export async function registerWebview(
  app: FastifyInstance,
  webviewRoot: string,
): Promise<void> {
  const published = await registerVersionedWebview(app, webviewRoot);
  await app.register(fastifyStatic, {
    root: published ? [published.root, webviewRoot] : webviewRoot,
    prefix: "/",
    preCompressed: true,
    setHeaders(response) {
      response.setHeader("Vary", "Accept-Encoding");
    },
  });
  app.get("/", async (_request, reply) => {
    if (published) {
      return reply
        .header("Cache-Control", "no-cache")
        .type("text/html")
        .send(published.html);
    }
    return reply.sendFile("index.html");
  });
  app.setNotFoundHandler((request, reply) => {
    if (
      ["/@fs/", "/assets/", ASSET_PREFIX].some((prefix) =>
        request.url.startsWith(prefix),
      )
    ) {
      return reply.code(404).send({ error: "Not Found" });
    }
    if (request.method === "GET") {
      if (published) {
        return reply
          .header("Cache-Control", "no-cache")
          .type("text/html")
          .send(published.html);
      }
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ error: "Not Found" });
  });
}
