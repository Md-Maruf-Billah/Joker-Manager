import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  "dist",
  ".preview.err.log",
  ".preview.out.log",
  ".vite-dev.err.log",
  ".vite-dev.out.log",
  "tsconfig.tsbuildinfo",
  "tsconfig.node.tsbuildinfo",
  "vite.config.js",
  "vite.config.d.ts"
];

for (const target of targets) {
  const fullPath = path.resolve(root, target);
  if (!fullPath.startsWith(root)) {
    throw new Error(`Refusing to clean outside project: ${target}`);
  }

  await rm(fullPath, { force: true, recursive: true });
}

console.log("Cleaned generated files.");

