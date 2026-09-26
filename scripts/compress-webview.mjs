import { readdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

const compress = promisify(gzip);
const webviewRoot = fileURLToPath(
  new URL("../scratch/asar/webview/", import.meta.url),
);
const extensions = new Set([".js", ".css", ".html", ".json", ".svg"]);

async function compressDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await compressDirectory(filename);
    } else if (entry.isFile() && extensions.has(path.extname(filename))) {
      const original = await readFile(filename);
      const compressed =
        original.length >= 1024 ? await compress(original, { level: 6 }) : null;
      const target = `${filename}.gz`;
      // Always refresh variants: patched assets keep their original filenames.
      if (compressed && compressed.length < original.length) {
        const existing = await readFile(target).catch((error) => {
          if (error.code !== "ENOENT") throw error;
          return null;
        });
        // Preserve validators for unchanged assets across UI rebuilds.
        if (existing?.equals(compressed)) continue;
        const temporary = `${target}.${process.pid}.tmp`;
        try {
          await writeFile(temporary, compressed);
          await rename(temporary, target);
        } finally {
          await rm(temporary, { force: true });
        }
      } else {
        await rm(target, { force: true });
      }
    }
  }
}

await compressDirectory(webviewRoot);
console.log("Prepared gzip variants for webview assets.");
