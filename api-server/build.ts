import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { rm, readFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  await rm(distDir, { recursive: true, force: true });

  console.log("Building server...");

  await esbuild({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: path.resolve(distDir, "index.cjs"),
    // تصحيح الـ Alias ليشير للمجلد الأب للقاعدة وليس الملف نفسه
    alias: {
      "@workspace/db": path.resolve(__dirname, "../lib/db/src")
    },
    // هذا السطر يخبر esbuild أن يتجاهل المكتبات الموجودة في node_modules ويتركها للسيرفر
    packages: "external", 
    bundle: true,
    logLevel: "info",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  });
  
  console.log("Build finished successfully!");
}

buildAll().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
