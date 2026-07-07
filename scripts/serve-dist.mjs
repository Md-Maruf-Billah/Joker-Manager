import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "dist");
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function safeFilePath(requestUrl) {
  const url = new URL(requestUrl, `http://127.0.0.1:${port}`);
  const decoded = decodeURIComponent(url.pathname);
  const requested = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, requested);

  if (!filePath.startsWith(root)) {
    return path.join(root, "index.html");
  }

  if (existsSync(filePath) && !filePath.endsWith(path.sep)) {
    return filePath;
  }

  return path.join(root, "index.html");
}

createServer(async (request, response) => {
  try {
    const filePath = safeFilePath(request.url || "/");
    const ext = path.extname(filePath);
    const body = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-store" : "public, max-age=3600"
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Preview server error");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Joker Manager preview: http://127.0.0.1:${port}/`);
});
