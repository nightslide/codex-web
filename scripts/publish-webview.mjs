import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  copyFile,
  link,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ASSET_PREFIX = "/__codex_assets/";
const defaultRoot = fileURLToPath(
  new URL("../scratch/asar/webview/", import.meta.url),
);

async function listFiles(root, relative = "") {
  const files = [];
  for (const entry of await readdir(path.join(root, relative), {
    withFileTypes: true,
  })) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, name)));
    else if (entry.isFile()) files.push(name);
  }
  return files.sort();
}

/** Publish an immutable snapshot. Never link back to mutable build inputs. */
export async function publishWebview(
  webviewRoot = defaultRoot,
  buildRoot = path.resolve(webviewRoot, "../webview-builds"),
) {
  const index = await readFile(path.join(webviewRoot, "index.html"), "utf8");
  const entries = [];
  const revisionHash = createHash("sha256").update(index);
  for (const relative of await listFiles(path.join(webviewRoot, "assets"))) {
    const source = path.join(webviewRoot, "assets", relative);
    const digest = createHash("sha256")
      .update(await readFile(source))
      .digest("hex");
    const name = `assets/${relative}`;
    revisionHash.update(JSON.stringify([name, digest]));
    entries.push({ name, source, digest });
  }
  const revision = revisionHash.digest("hex");
  const releaseRoot = path.join(buildRoot, "releases", revision);
  const objectsRoot = path.join(buildRoot, "objects");
  await mkdir(objectsRoot, { recursive: true });
  await mkdir(path.dirname(releaseRoot), { recursive: true });

  // Content-addressed objects keep unchanged assets shared across releases.
  // Old releases remain readable by tabs that have not reloaded yet.
  if (
    !(await stat(releaseRoot).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    }))
  ) {
    const staging = `${releaseRoot}.${randomUUID()}.tmp`;
    try {
      await mkdir(staging);
      for (const entry of entries) {
        const object = path.join(objectsRoot, entry.digest);
        if (
          !(await stat(object).catch((error) => {
            if (error.code !== "ENOENT") throw error;
            return null;
          }))
        ) {
          const temporaryObject = `${object}.${randomUUID()}.tmp`;
          try {
            await copyFile(
              entry.source,
              temporaryObject,
              constants.COPYFILE_FICLONE,
            );
            const copiedDigest = createHash("sha256")
              .update(await readFile(temporaryObject))
              .digest("hex");
            if (copiedDigest !== entry.digest) {
              throw new Error(
                `Browser asset changed during publishing: ${entry.name}`,
              );
            }
            await link(temporaryObject, object).catch((error) => {
              if (error.code !== "EEXIST") throw error;
            });
          } finally {
            await rm(temporaryObject, { force: true });
          }
        }
        const destination = path.join(staging, entry.name);
        await mkdir(path.dirname(destination), { recursive: true });
        await link(object, destination);
      }
      const html = index.replace(
        /\b(src|href)=(['"])(?:\.\/|\/)assets\//g,
        (_match, attribute, quote) =>
          `${attribute}=${quote}${ASSET_PREFIX}${revision}/assets/`,
      );
      await writeFile(path.join(staging, "index.html"), html);
      await rename(staging, releaseRoot).catch((error) => {
        if (error.code !== "EEXIST" && error.code !== "ENOTEMPTY") throw error;
      });
    } finally {
      await rm(staging, { force: true, recursive: true });
    }
  }

  const temporary = path.join(buildRoot, `current.${randomUUID()}.tmp`);
  try {
    // Keep old snapshots on the host, but ship only the current release.
    await writeFile(
      path.join(buildRoot, "releases", ".npmignore"),
      `*\n!/${revision}/\n!/${revision}/**\n`,
    );
    await writeFile(temporary, JSON.stringify({ version: 1, revision }) + "\n");
    await rename(temporary, path.join(buildRoot, "current.json"));
  } finally {
    await rm(temporary, { force: true });
  }
  return { revision, releaseRoot };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { revision } = await publishWebview();
  console.log(`Published browser assets: ${revision.slice(0, 12)}`);
}
