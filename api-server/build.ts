import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { rm, readFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  await rm(distDir, { recursive: true, force: true });

  console.log("building server...");
  const pkgPath = path.resolve(__dirname, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];

  // التعديل هنا: نقوم بدمج أي شيء يبدأ بـ workspace داخل الـ bundle
  const externals = allDeps.filter(
    (dep) => {
      const isWorkspace = pkg.dependencies?.[dep]?.startsWith("workspace:") || 
                          pkg.devDependencies?.[dep]?.startsWith("workspace:");
      return !allowlist.includes(dep) && !isWorkspace;
    }
  );

  await esbuild({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: path.resolve(distDir, "index.cjs"),
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals, // الآن سيتم دمج @workspace/db تلقائياً
    logLevel: "info",
    // إضافة alias لضمان توجيه المسار للمجلد الصحيح أثناء البناء
  // ... داخل إعدادات esbuild في ملف build.ts
  alias: {
    "@workspace/db": path.resolve(__dirname, "../lib/db/src/index.ts")
  },
  external: externals,
  // ...
  });
  console.log("Build finished successfully!");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
