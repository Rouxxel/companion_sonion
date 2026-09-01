import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const source = join(import.meta.dirname, "..", "src", "renderer");
const destination = join(import.meta.dirname, "..", "dist", "renderer");
const assetSource = join(import.meta.dirname, "..", "src", "assets");
const assetDestination = join(import.meta.dirname, "..", "dist", "assets");
const defaultAsset = join(import.meta.dirname, "..", "..", "ide_companion", "vscode_version", "media", "sonion.jpeg");

await rm(destination, { force: true, recursive: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true, filter: (entry) => !entry.endsWith(".ts") });
await rm(assetDestination, { force: true, recursive: true });
await mkdir(assetDestination, { recursive: true });
await cp(assetSource, assetDestination, { recursive: true });
await cp(defaultAsset, join(assetDestination, "sonion.jpeg"));
