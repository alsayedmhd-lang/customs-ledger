import path from "path";
import dotenv from "dotenv";

const runtimeScriptDir = path.dirname(process.argv[1] || process.cwd());

dotenv.config({
  path: path.resolve(runtimeScriptDir, "../.env"),
});

async function start() {
  const { default: app } = await import("./app");
  const { seedAdminUser } = await import("./seed-admin");

  const port = Number(process.env["PORT"] || 3000);

  if (Number.isNaN(port) || port <= 0) {
    console.error(`❌ Invalid PORT value: "${process.env["PORT"]}"`);
    process.exit(1);
  }

  const server = app.listen(port, "0.0.0.0", async () => {
    console.log("🚀 Server is officially live!");
    console.log(`🌍 Access it at: http://0.0.0.0:${port}`);
    console.log(`📡 Listening on port: ${port}`);

    try {
      console.log("⏳ Starting admin seeding...");
      await seedAdminUser();
      console.log("✅ Admin user seeding completed.");
    } catch (error) {
      console.error("❌ Seeding failed:", error);
    }
  });

  server.on("close", () => {
    console.error("❌ Server closed unexpectedly");
  });

  server.on("error", (error) => {
    console.error("❌ Server error:", error);
  });
}

start().catch((error) => {
  console.error("❌ Server failed to start:", error);
  process.exit(1);
});