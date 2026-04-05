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
  console.log(`🚀 Server listening on port ${port}`);
  
  try {
    await seedAdminUser();
    console.log("✅ Admin user seeding completed.");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    // لا نغلق السيرفر هنا لكي يستمر في العمل حتى لو فشل الـ seed
  }
});






// import app from "./app";
// import { seedAdminUser } from "./seed-admin";

// const rawPort = process.env["PORT"];

// if (!rawPort) {
//   throw new Error(
//     "PORT environment variable is required but was not provided.",
//   );
// }

// const port = Number(rawPort);

// if (Number.isNaN(port) || port <= 0) {
//   throw new Error(`Invalid PORT value: "${rawPort}"`);
// }

// app.listen(port, async () => {
//   console.log(`Server listening on port ${port}`);
//   await seedAdminUser();
// });
