import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { rm } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  await rm(distDir, { recursive: true, force: true });

  console.log("🚀 Starting Final Bundle Build...");

  await esbuild({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    platform: "node",
    bundle: true, // دمج كافة المكتبات (مثل express) داخل الملف
    format: "cjs",
    target: "node22", // متوافق مع نسخة Node الحالية في Render
    outfile: path.resolve(distDir, "index.cjs"),
    alias: {
      "@workspace/db": path.resolve(__dirname, "../lib/db/src")
    },
    external: [], // مصفوفة فارغة لضمان دمج كل شيء
    minify: false,
    sourcemap: true,
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
