import path from "path";
import { fileURLToPath } from "url";
import { build } from "esbuild";
import { rm } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  await rm(distDir, { recursive: true, force: true });

  console.log("🚀 Starting Final Standalone Build...");

  await build({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    target: "node22",
    outfile: path.resolve(distDir, "index.cjs"),
    packages: "external",
    alias: {
      "@workspace/db": path.resolve(__dirname, "../lib/db/src"),
      "@workspace/api-zod": path.resolve(__dirname, "../lib/api-zod/src"),
    },
    minify: false,
    sourcemap: true,
    logLevel: "info",
  });

  console.log("✅ Build complete!");
}

buildAll().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
