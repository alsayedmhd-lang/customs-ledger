import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { rm } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  await rm(distDir, { recursive: true, force: true });

  console.log("🚀 Starting Production Build...");

  await esbuild({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    target: "node22",
    outfile: path.resolve(distDir, "index.cjs"),
    
    // تعريف المسارات الخاصة بالـ workspace لتضمينها في البناء
    alias: {
      "@workspace/db": path.resolve(__dirname, "../lib/db/src"),
      "@workspace/api-zod": path.resolve(__dirname, "../lib/api-zod/src") // أضفت هذا بناءً على خطأ api-zod
    },

    // الحل السحري: إخبار esbuild أن يتجاهل كل المكتبات المثبتة عبر npm
    // ويتركها ليتم سحبها من node_modules وقت التشغيل
    packages: "external", 

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
