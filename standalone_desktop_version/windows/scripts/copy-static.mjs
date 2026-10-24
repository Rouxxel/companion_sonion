import { cp, mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

// Copies the non-TypeScript app files into dist/. Everything comes from this project
// (src/renderer and resources/assets); nothing is read from outside this folder.
const root = join(import.meta.dirname, "..");
const copies = [
  { from: join(root, "src", "renderer"), to: join(root, "dist", "renderer"), filter: (entry) => !entry.endsWith(".ts") },
  { from: join(root, "resources", "assets"), to: join(root, "dist", "assets") }
];
const requiredFiles = [
  join(root, "resources", "assets", "sonion.jpeg"),
  join(root, "resources", "assets", "tray-icon.png"),
  join(root, "resources", "build", "icon.ico")
];

for (const file of requiredFiles) {
  try {
    await stat(file);
  } catch {
    console.error(`copy-static: missing required resource ${file}`);
    process.exit(1);
  }
}

for (const { from, to, filter } of copies) {
  await rm(to, { force: true, recursive: true });
  await mkdir(to, { recursive: true });
  await cp(from, to, { recursive: true, filter });
}
