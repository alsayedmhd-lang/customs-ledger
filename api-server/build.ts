import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { rm } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  await rm(distDir, { recursive: true, force: true });

  console.log("🚀 Starting Production Build (Full Bundle)...");

  await esbuild({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    platform: "node",
    bundle: true, // دمج كل شيء
    format: "cjs",
    target: "node22",
    outfile: path.resolve(distDir, "index.cjs"),
    // تحديد مسارات المكتبات يدوياً لـ esbuild
    nodePaths: [path.resolve(__dirname, "../node_modules")], 
    alias: {
      "@workspace/db": path.resolve(__dirname, "../lib/db/src"),
      "@workspace/api-zod": path.resolve(__dirname, "../lib/api-zod/src"),
    },
    // استثناء المكتبات التي تحتوي على ملفات ثنائية (Binary) فقط
    external: ["fsevents", "bcrypt"], 
    minify: false,
    sourcemap: true,
    logLevel: "info",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  });
  
  console.log("✅ Build finished successfully!");
}

buildAll().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
