import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import { usersTable, otpCodesTable, DEFAULT_PERMISSIONS } from "@workspace/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { signToken, requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "atw-customs-secret-2026";

// ── OTP helpers ───────────────────────────────────────────────────────────────

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

function maskPhone(phone: string): string {
  return phone.slice(0, 3) + "*".repeat(Math.max(phone.length - 5, 2)) + phone.slice(-2);
}

function signOtpToken(userId: number): string {
  return jwt.sign({ userId, type: "otp_pending" }, JWT_SECRET, { expiresIn: "5m" });
}

async function sendOTPEmail(to: string, code: string, displayName: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || "465");

  if (!host || !user || !pass) {
    console.warn(`[OTP] SMTP not configured — code: ${code}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  await transporter.sendMail({
    from: `"حول العالم للتخليص الجمركي" <${user}>`,
    to,
    subject: `رمز التحقق: ${code}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #1d4ed8; margin-bottom: 8px;">حول العالم للتخليص الجمركي</h2>
        <p style="color: #374151;">مرحباً <strong>${displayName}</strong>،</p>
        <p style="color: #374151;">رمز التحقق الخاص بك لتسجيل الدخول هو:</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1d4ed8;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px;">صالح لمدة 5 دقائق. لا تشاركه مع أحد.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="color: #9ca3af; font-size: 11px; text-align: center;">Around The World Customs Clearance — Doha, Qatar</p>
      </div>
    `,
  });
  return true;
}

async function sendPasswordResetEmail(to: string, code: string, displayName: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || "465");

  if (!host || !user || !pass) {
    console.warn(`[RESET] SMTP not configured — code: ${code}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  await transporter.sendMail({
    from: `"حول العالم للتخليص الجمركي" <${user}>`,
    to,
    subject: `إعادة تعيين كلمة المرور — رمز التحقق: ${code}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #dc2626; margin-bottom: 8px;">إعادة تعيين كلمة المرور</h2>
        <p style="color: #374151; margin-bottom: 4px;">مرحباً <strong>${displayName}</strong>،</p>
        <p style="color: #374151;">تلقّينا طلباً لإعادة تعيين كلمة المرور لحسابك. رمز التحقق هو:</p>
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #dc2626;">${code}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px;">صالح لمدة 10 دقائق. إن لم تطلب ذلك، تجاهل هذه الرسالة.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="color: #9ca3af; font-size: 11px; text-align: center;">حول العالم للتخليص الجمركي — الدوحة، قطر</p>
      </div>
    `,
  });
  return true;
}

async function sendOTPWhatsApp(phone: string, code: string, displayName: string, apiKey: string): Promise<boolean> {
  if (!apiKey) {
    console.warn(`[OTP] WhatsApp apiKey missing for phone ${phone} — code: ${code}`);
    return false;
  }

  // Normalize phone: remove spaces, dashes, leading +
  const normalized = phone.replace(/[\s\-]/g, "").replace(/^\+/, "");
  const text = encodeURIComponent(`حول العالم للتخليص الجمركي\n\nمرحباً ${displayName}\nرمز التحقق الخاص بك: *${code}*\nصالح لمدة 5 دقائق فقط.`);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${normalized}&text=${text}&apikey=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[OTP] WhatsApp send failed: ${res.status}`);
    return false;
  }
  return true;
}

// ── Self-Registration ─────────────────────────────────────────────────────────

router.post("/auth/register", async (req, res) => {
  const { username, displayName, email, phone, password } = req.body as {
    username: string; displayName: string; email?: string; phone?: string; password: string;
  };

  if (!username || !displayName || !password) {
    return res.status(400).json({ message: "اسم المستخدم والاسم الكامل وكلمة السر مطلوبة" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "كلمة السر يجب أن تكون 6 أحرف على الأقل" });
  }

  const uname = username.trim().toLowerCase();
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, uname)).limit(1);
  if (existing) {
    return res.status(409).json({ message: "اسم المستخدم مستخدم بالفعل، اختر اسماً آخر" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(usersTable).values({
    username: uname,
    passwordHash,
    displayName: displayName.trim(),
    role: "user",
    isActive: false,
    pendingApproval: true,
    email: email?.trim() || null,
    phone: phone?.trim() || null,
    permissions: DEFAULT_PERMISSIONS,
  });

  return res.status(201).json({ message: "تم إنشاء حسابك بنجاح — في انتظار تفعيله من قبل المدير" });
});

// ── Login (Step 1) ────────────────────────────────────────────────────────────

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string };

    if (!username || !password) {
      return res.status(400).json({ message: "اسم المستخدم وكلمة السر مطلوبان" });
    }

    const normalizedUsername = username.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, normalizedUsername))
      .limit(1);

    if (!user) {
      return res.status(401).json({ message: "اسم المستخدم أو كلمة السر غير صحيحة" });
    }

    if (!user.passwordHash) {
      console.error("[AUTH LOGIN] Missing passwordHash");
      return res.status(500).json({ message: "بيانات الحساب غير مكتملة" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({ message: "اسم المستخدم أو كلمة السر غير صحيحة" });
    }

    if (user.pendingApproval) {
      return res.status(403).json({
        message: "حسابك في انتظار تفعيل من قبل المدير",
        pendingApproval: true,
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "تم إيقاف الحساب" });
    }

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db
      .delete(otpCodesTable)
      .where(and(eq(otpCodesTable.userId, user.id), isNull(otpCodesTable.usedAt)));

    await db.insert(otpCodesTable).values({
      userId: user.id,
      code,
      expiresAt,
    });

    const otpToken = signOtpToken(user.id);

    return res.json({
      requiresOtp: true,
      otpToken,
      visibleCode: code,
    });
    } catch (error) {
      console.error("[AUTH LOGIN ERROR FULL]");
      console.error(error);
      console.error(JSON.stringify(error, null, 2));
    
      return res.status(500).json({
        message: "حدث خطأ أثناء تسجيل الدخول",
      });
    }
});
  // router.post("/auth/login", async (req, res) => {
  //   try {
  //     const { username, password } = req.body as { username: string; password: string };
  
  //     if (!username || !password) {
  //       return res.status(400).json({ message: "اسم المستخدم وكلمة السر مطلوبان" });
  //     }
  
  //     const normalizedUsername = username.trim().toLowerCase();
  
  //     const [user] = await db
  //       .select()
  //       .from(usersTable)
  //       .where(eq(usersTable.username, normalizedUsername))
  //       .limit(1);
  
  //     if (!user) {
  //       return res.status(401).json({ message: "اسم المستخدم أو كلمة السر غير صحيحة" });
  //     }
  
  //     if (!user.passwordHash) {
  //       console.error("[AUTH LOGIN] Missing passwordHash for user:", user.id, user.username);
  //       return res.status(500).json({ message: "بيانات الحساب غير مكتملة" });
  //     }
  
  //     const valid = await bcrypt.compare(password, user.passwordHash);
  //     if (!valid) {
  //       return res.status(401).json({ message: "اسم المستخدم أو كلمة السر غير صحيحة" });
  //     }
  
  //     if (user.pendingApproval) {
  //       return res.status(403).json({
  //         message: "حسابك في انتظار تفعيل من قبل المدير — الرجاء المحاولة لاحقاً",
  //         pendingApproval: true,
  //       });
  //     }
  
  //     if (!user.isActive) {
  //       return res.status(403).json({ message: "تم إيقاف حسابك — تواصل مع المدير" });
  //     }
  
  //     const code = generateOTP();
  //     const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  
  //     await db
  //       .delete(otpCodesTable)
  //       .where(and(eq(otpCodesTable.userId, user.id), isNull(otpCodesTable.usedAt)));
  
  //     await db.insert(otpCodesTable).values({
  //       userId: user.id,
  //       code,
  //       expiresAt,
  //     });
  
  //     let sent = false;
  
  //     if (user.email) {
  //       try {
  //         sent = await sendOTPEmail(user.email, code, user.displayName);
  //       } catch (err) {
  //         console.error("[OTP] Email error:", err);
  //       }
  //     }
  
  //     if (user.phone && user.whatsappApiKey) {
  //       try {
  //         const waSent = await sendOTPWhatsApp(
  //           user.phone,
  //           code,
  //           user.displayName,
  //           user.whatsappApiKey,
  //         );
  //         if (waSent) sent = true;
  //       } catch (err) {
  //         console.error("[OTP] WhatsApp error:", err);
  //       }
  //     }
  
  //     const otpToken = signOtpToken(user.id);
  
  //     return res.json({
  //       requiresOtp: true,
  //       otpToken,
  //       maskedEmail: user.email ? maskEmail(user.email) : null,
  //       maskedPhone: user.phone ? maskPhone(user.phone) : null,
  //       visibleCode: !sent ? code : undefined,
  //     });
  //   } catch (error) {
  //     console.error("[AUTH LOGIN ERROR]", error);
  //     return res.status(500).json({ message: "حدث خطأ داخلي أثناء تسجيل الدخول" });
  //   }
  // });

// ── Verify OTP (Step 2) ───────────────────────────────────────────────────────

router.post("/auth/verify-otp", async (req, res) => {
  const { otpToken, code } = req.body as { otpToken: string; code: string };
  if (!otpToken || !code) {
    return res.status(400).json({ message: "رمز التحقق مطلوب" });
  }

  let payload: { userId: number; type: string };
  try {
    payload = jwt.verify(otpToken, JWT_SECRET) as { userId: number; type: string };
  } catch {
    return res.status(401).json({ message: "انتهت صلاحية جلسة التحقق — الرجاء تسجيل الدخول من جديد" });
  }

  if (payload.type !== "otp_pending") {
    return res.status(401).json({ message: "رمز جلسة غير صالح" });
  }

  const now = new Date();
  const [otpRecord] = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.userId, payload.userId),
        eq(otpCodesTable.code, code.trim()),
        gt(otpCodesTable.expiresAt, now),
        isNull(otpCodesTable.usedAt)
      )
    )
    .limit(1);

  if (!otpRecord) {
    return res.status(401).json({ message: "رمز التحقق غير صحيح أو انتهت صلاحيته" });
  }

  await db.update(otpCodesTable).set({ usedAt: now }).where(eq(otpCodesTable.id, otpRecord.id));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
  if (!user || !user.isActive) {
    return res.status(401).json({ message: "الحساب غير نشط" });
  }

  const token = signToken({ userId: user.id, username: user.username, role: user.role });
  const permissions = user.role === "admin" ? DEFAULT_PERMISSIONS : (user.permissions ?? DEFAULT_PERMISSIONS);
  return res.json({
    token,
    user: { id: user.id, username: user.username, displayName: user.displayName, displayNameAr: user.displayNameAr ?? null, displayNameEn: user.displayNameEn ?? null, role: user.role, permissions, phone: user.phone ?? null, email: user.email ?? null },
  });
});

// ── Resend OTP ────────────────────────────────────────────────────────────────

router.post("/auth/resend-otp", async (req, res) => {
  const { otpToken } = req.body as { otpToken: string };
  if (!otpToken) return res.status(400).json({ message: "البيانات ناقصة" });

  let payload: { userId: number; type: string };
  try {
    payload = jwt.verify(otpToken, JWT_SECRET) as { userId: number; type: string };
  } catch {
    return res.status(401).json({ message: "انتهت صلاحية الجلسة — الرجاء تسجيل الدخول من جديد" });
  }

  if (payload.type !== "otp_pending") {
    return res.status(401).json({ message: "رمز جلسة غير صالح" });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
  if (!user || !user.isActive) return res.status(401).json({ message: "الحساب غير نشط" });

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await db.delete(otpCodesTable).where(and(eq(otpCodesTable.userId, user.id), isNull(otpCodesTable.usedAt)));
  await db.insert(otpCodesTable).values({ userId: user.id, code, expiresAt });

  let sentResend = false;

  if (user.email) {
    try { sentResend = await sendOTPEmail(user.email, code, user.displayName); }
    catch (err) { console.error("[OTP] Resend email error:", err); }
  }

  if (user.phone && user.whatsappApiKey) {
    try {
      const waSent = await sendOTPWhatsApp(user.phone, code, user.displayName, user.whatsappApiKey);
      if (waSent) sentResend = true;
    } catch (err) { console.error("[OTP] Resend WhatsApp error:", err); }
  }

  const newOtpToken = signOtpToken(user.id);
  return res.json({
    requiresOtp: true,
    otpToken: newOtpToken,
    maskedEmail: user.email ? maskEmail(user.email) : null,
    maskedPhone: user.phone ? maskPhone(user.phone) : null,
    visibleCode: !sentResend ? code : undefined,
    message: "تم إرسال رمز تحقق جديد",
  });
});

// ── Forgot Password (Step 1) ─────────────────────────────────────────────────

router.post("/auth/forgot-password", async (req, res) => {
  const { username } = req.body as { username: string };
  if (!username) return res.status(400).json({ message: "اسم المستخدم مطلوب" });

  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.username, username.trim().toLowerCase())).limit(1);

  // Don't reveal whether username exists — but we need to return a token for the next step
  if (!user || !user.isActive || user.pendingApproval) {
    // Return generic success to prevent username enumeration
    return res.json({ message: "إذا كان الحساب موجوداً وفعّالاً، سيصلك رمز التحقق على بريدك الإلكتروني." });
  }

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await db.delete(otpCodesTable).where(and(eq(otpCodesTable.userId, user.id), isNull(otpCodesTable.usedAt)));
  await db.insert(otpCodesTable).values({ userId: user.id, code, expiresAt });

  let sent = false;
  if (user.email) {
    try { sent = await sendPasswordResetEmail(user.email, code, user.displayName); }
    catch (err) { console.error("[RESET] Email error:", err); }
  }

  const resetToken = jwt.sign({ userId: user.id, type: "reset_otp" }, JWT_SECRET, { expiresIn: "10m" });
  return res.json({
    resetToken,
    maskedEmail: user.email ? maskEmail(user.email) : null,
    visibleCode: !sent ? code : undefined,
  });
});

// ── Verify Reset OTP (Step 2) ─────────────────────────────────────────────────

router.post("/auth/verify-reset-otp", async (req, res) => {
  const { resetToken, code } = req.body as { resetToken: string; code: string };
  if (!resetToken || !code) return res.status(400).json({ message: "البيانات ناقصة" });

  let payload: { userId: number; type: string };
  try {
    payload = jwt.verify(resetToken, JWT_SECRET) as { userId: number; type: string };
  } catch {
    return res.status(401).json({ message: "انتهت صلاحية جلسة إعادة التعيين — ابدأ من جديد" });
  }
  if (payload.type !== "reset_otp") return res.status(401).json({ message: "رمز جلسة غير صالح" });

  const now = new Date();
  const [otpRecord] = await db.select().from(otpCodesTable).where(
    and(
      eq(otpCodesTable.userId, payload.userId),
      eq(otpCodesTable.code, code.trim()),
      gt(otpCodesTable.expiresAt, now),
      isNull(otpCodesTable.usedAt)
    )
  ).limit(1);

  if (!otpRecord) return res.status(401).json({ message: "رمز التحقق غير صحيح أو انتهت صلاحيته" });

  await db.update(otpCodesTable).set({ usedAt: now }).where(eq(otpCodesTable.id, otpRecord.id));

  const passwordChangeToken = jwt.sign({ userId: payload.userId, type: "reset_password" }, JWT_SECRET, { expiresIn: "15m" });
  return res.json({ passwordChangeToken });
});

// ── Set New Password (Step 3) ─────────────────────────────────────────────────

router.post("/auth/set-new-password", async (req, res) => {
  const { passwordChangeToken, newPassword } = req.body as { passwordChangeToken: string; newPassword: string };
  if (!passwordChangeToken || !newPassword) return res.status(400).json({ message: "البيانات ناقصة" });
  if (newPassword.length < 6) return res.status(400).json({ message: "كلمة السر يجب أن تكون 6 أحرف على الأقل" });

  let payload: { userId: number; type: string };
  try {
    payload = jwt.verify(passwordChangeToken, JWT_SECRET) as { userId: number; type: string };
  } catch {
    return res.status(401).json({ message: "انتهت صلاحية جلسة تغيير كلمة السر — ابدأ من جديد" });
  }
  if (payload.type !== "reset_password") return res.status(401).json({ message: "رمز جلسة غير صالح" });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, payload.userId));

  return res.json({ message: "تم تغيير كلمة السر بنجاح — يمكنك تسجيل الدخول الآن" });
});

// ── Admin: Send Reset Code to User ────────────────────────────────────────────

router.post("/auth/admin-send-reset/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });

  const code = generateOTP();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min for admin-initiated

  await db.delete(otpCodesTable).where(and(eq(otpCodesTable.userId, user.id), isNull(otpCodesTable.usedAt)));
  await db.insert(otpCodesTable).values({ userId: user.id, code, expiresAt });

  const resetToken = jwt.sign({ userId: user.id, type: "reset_otp" }, JWT_SECRET, { expiresIn: "30m" });

  let sent = false;
  if (user.email) {
    try { sent = await sendPasswordResetEmail(user.email, code, user.displayName); }
    catch (err) { console.error("[RESET] Admin email error:", err); }
  }

  return res.json({
    sent,
    resetToken,
    maskedEmail: user.email ? maskEmail(user.email) : null,
    visibleCode: !sent ? code : undefined,
    message: sent
      ? `تم إرسال رمز إعادة التعيين إلى بريد المستخدم`
      : `المستخدم لا يملك بريداً إلكترونياً — الرمز يظهر أدناه`,
  });
});

// ── Logout / Me ───────────────────────────────────────────────────────────────

router.post("/auth/logout", (_req, res) => {
  return res.json({ message: "تم تسجيل الخروج" });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);
  if (!user) return res.status(404).json({ message: "المستخدم غير موجود" });
  const permissions = user.role === "admin" ? DEFAULT_PERMISSIONS : (user.permissions ?? DEFAULT_PERMISSIONS);
  return res.json({ id: user.id, username: user.username, displayName: user.displayName, displayNameAr: user.displayNameAr ?? null, displayNameEn: user.displayNameEn ?? null, role: user.role, permissions, phone: user.phone ?? null, email: user.email ?? null });
});

export default router;
