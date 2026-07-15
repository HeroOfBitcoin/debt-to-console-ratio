import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = resolve(projectRoot, "public");
const distDirectory = resolve(projectRoot, "dist");

await mkdir(distDirectory, { recursive: true });
await cp(publicDirectory, distDirectory, { recursive: true, force: true });
