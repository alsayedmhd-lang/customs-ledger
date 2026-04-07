import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";

export async function seedAdminUser() {
  const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  if (existing.length > 0) return;

  const passwordHash = await bcrypt.hash("admin123", 10);

  await db.insert(usersTable).values({
    username: "admin",
    passwordHash,
    displayName: "المدير",
    role: "admin",
    isActive: true,
  });

  console.log("✅ Admin user created — username: admin | password: admin123");
}




// import bcrypt from "bcryptjs";
// import { db } from "@workspace/db";
// import { usersTable } from "@workspace/db/schema";

// export async function seedAdminUser() {
//   try {
//     const existing = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
//     if (existing.length > 0) return;
//     const passwordHash = await bcrypt.hash("admin123", 10);
//     await db.insert(usersTable).values({
//       username: "admin",
//       passwordHash,
//       displayName: "المدير",
//       role: "admin",
//       isActive: true,
//     });
//     console.log("✅ Admin user created — username: admin | password: admin123");
//   } catch (err) {
//     console.error("Seed admin error:", err);
//   }
// }
