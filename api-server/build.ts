import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { rm, readFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  const pkgPath = path.resolve(__dirname, "package.json");
  
  // 1. تنظيف المجلد القديم
  await rm(distDir, { recursive: true, force: true });

  // 2. قراءة المكتبات من package.json لاستثنائها من الدمج إذا لزم الأمر
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  const externalDependencies = Object.keys(pkg.dependencies || {});

  console.log("🚀 Building server with dynamic external resolution...");

  await esbuild({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    target: "node20",
    outfile: path.resolve(distDir, "index.cjs"),
    
    // تعريف المسار الخاص بقاعدة البيانات
    alias: {
      "@workspace/db": path.resolve(__dirname, "../lib/db/src")
    },

    // نجعل المكتبات خارجية لنتجنب أخطاء "Could not resolve" أثناء البناء
    external: externalDependencies, 

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
