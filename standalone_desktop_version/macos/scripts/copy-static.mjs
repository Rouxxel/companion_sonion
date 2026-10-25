import { cp, mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

// Copies this app's bundled assets (resources/assets) into dist/assets. The renderer pages and the
// preload script ship inside @sonion/companion-core (standalone_desktop_version/shared).
const root = join(import.meta.dirname, "..");
const requiredFiles = [
  join(root, "resources", "assets", "sonion.jpeg"),
  join(root, "resources", "assets", "trayTemplate.png"),
  join(root, "resources", "assets", "trayTemplate@2x.png"),
  join(root, "resources", "build", "icon.png")
];

for (const file of requiredFiles) {
  try {
    await stat(file);
  } catch {
    console.error(`copy-static: missing required resource ${file}`);
    process.exit(1);
  }
}

const target = join(root, "dist", "assets");
await rm(target, { force: true, recursive: true });
await mkdir(target, { recursive: true });
await cp(join(root, "resources", "assets"), target, { recursive: true });
