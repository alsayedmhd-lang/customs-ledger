import app from "./app";
import { seedAdminUser } from "./seed-admin";

// 1. جعل المنفذ مرناً مع قيمة افتراضية لـ Render (عادة 10000)
const port = Number(process.env["PORT"] || 10000);

// التحقق من صحة المنفذ بشكل أبسط
if (Number.isNaN(port) || port <= 0) {
  console.error(`❌ Invalid PORT value: "${process.env["PORT"]}"`);
  process.exit(1); 
}

// 2. إضافة "0.0.0.0" لضمان قبول الاتصالات الخارجية في Render
app.listen(port, "0.0.0.0", async () => {
  // --- رسالة التأكيد هنا ---
  console.log(`🚀 Server is officially live!`);
  console.log(`🌍 Access it at: http://0.0.0.0:${port}`);
  console.log(`📡 Listening on port: ${port}`);
  // -------------------------
  
  try {
    console.log("⏳ Starting admin seeding...");
    await seedAdminUser();
    console.log("✅ Admin user seeding completed.");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    // لا نغلق السيرفر هنا لكي يستمر في العمل حتى لو فشل الـ seed
  }
});
