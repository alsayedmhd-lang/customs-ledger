import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { rm } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  
  // 1. تنظيف مجلد البناء القديم
  await rm(distDir, { recursive: true, force: true });

  console.log("🚀 Starting Final Bundle Build...");

  // 2. إعداد عملية البناء
  await esbuild({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    platform: "node",
    bundle: true, // دمج كافة المكتبات الخارجية داخل الملف
    format: "cjs",
    target: "node20", // متوافق مع نسخة Node على Render
    outfile: path.resolve(distDir, "index.cjs"),
    
    // تعريف المسارات المختصرة (Aliases)
    alias: {
      "@workspace/db": path.resolve(__dirname, "../lib/db/src")
    },

    // المكتبات التي يجب استثناؤها (فقط المكتبات التي تحتوي على ملفات C++ ثنائية)
    // إذا استمر خطأ bcryptjs، يمكنك إضافتها هنا وتثبيتها في Render بشكل منفصل
    external: [], 

    minify: false, // اجعله false لتسهيل تصحيح الأخطاء حالياً
    sourcemap: true,
    logLevel: "info",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  });
  
  console.log("✅ Build finished: api-server/dist/index.cjs is ready!");
}

buildAll().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
