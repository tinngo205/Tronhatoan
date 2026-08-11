"use server";

import { z } from "zod";
import { createClient, createAdminClient } from "@/infrastructure/supabase/server";
import { sendEmail } from "@/lib/mail";

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải chứa ít nhất 6 ký tự"),
});

const registerSchema = z
  .object({
    email: z.string().email("Email không hợp lệ"),
    password: z.string().min(6, "Mật khẩu phải chứa ít nhất 6 ký tự"),
    confirmPassword: z.string(),
    fullName: z.string().min(2, "Tên hiển thị phải chứa ít nhất 2 ký tự"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
  });

const forgotPasswordSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Mật khẩu phải chứa ít nhất 6 ký tự"),
});

export async function loginAction(formData: z.infer<typeof loginSchema>) {
  const validation = loginSchema.safeParse(formData);
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const { email, password } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Email hoặc mật khẩu không chính xác." };
  }

  return { success: true };
}

export async function registerAction(formData: z.infer<typeof registerSchema>) {
  const validation = registerSchema.safeParse(formData);
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const { email, password, fullName } = validation.data;
  const admin = createAdminClient();

  // 1. Check if user already exists
  const { data: { users }, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    return { error: `Lỗi truy vấn tài khoản: ${listError.message}` };
  }
  const user = users?.find((u) => u.email === email);

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
  console.log(`[DEVELOPMENT] Register OTP for ${email}: ${otp}`);

  let targetUserId = "";

  if (user) {
    // If the user exists and is confirmed, reject signup
    if (user.email_confirmed_at) {
      return { error: "Email này đã được đăng ký sử dụng." };
    }

    // If the user exists but is not confirmed, update their OTP
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      password, // update password in case they changed it
      user_metadata: {
        full_name: fullName,
        otp_code: otp,
        otp_expires_at: expiresAt,
      },
    });

    if (updateError) {
      return { error: `Không thể cập nhật thông tin đăng ký: ${updateError.message}` };
    }
    targetUserId = user.id;
  } else {
    // If the user does not exist, create as unconfirmed
    const { data: { user: newUser }, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // unconfirmed
      user_metadata: {
        full_name: fullName,
        otp_code: otp,
        otp_expires_at: expiresAt,
      },
    });

    if (createError) {
      return { error: `Đăng ký thất bại: ${createError.message}` };
    }
    if (!newUser) {
      return { error: "Đăng ký thất bại: Không thể tạo tài khoản." };
    }
    targetUserId = newUser.id;
  }

  // 2. Send the OTP code via SMTP
  const emailSubject = `[CoBuy] Mã xác thực OTP đăng ký tài khoản`;
  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
      <h2 style="color: #0ea5e9; margin-top: 0; text-align: center;">Xác Thực Tài Khoản CoBuy</h2>
      <p>Chào bạn <strong>${fullName}</strong>,</p>
      <p>Cảm ơn bạn đã đăng ký tài khoản trên ứng dụng <strong>CoBuy</strong>. Mã xác thực OTP của bạn là:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0ea5e9; border: 2px dashed #0ea5e9; padding: 10px 20px; border-radius: 8px; display: inline-block;">${otp}</span>
      </div>
      <p style="color: #71717a; font-size: 14px; text-align: center;">Mã OTP này có hiệu lực trong vòng <strong>10 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
      <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
      <p style="color: #a1a1aa; font-size: 12px; text-align: center;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
    </div>
  `;

  try {
    await sendEmail({
      to: email,
      subject: emailSubject,
      html: emailHtml,
    });
  } catch (emailError) {
    console.error("Failed to send signup OTP email:", emailError);
    return { error: "Không thể gửi email xác thực OTP qua SMTP. Vui lòng kiểm tra lại cấu hình email." };
  }

  return { success: true, requireOtp: true, email };
}

const verifyOtpSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  otp: z.string().length(6, "Mã OTP phải có đúng 6 ký tự"),
});

export async function verifyOtpAction(formData: { email: string; otp: string }) {
  const validation = verifyOtpSchema.safeParse(formData);
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const { email, otp } = validation.data;
  const admin = createAdminClient();

  // 1. Get user by email — dùng getUserByEmail trực tiếp (O(1) thay vì O(n))
  const { data: { users }, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    return { error: `Lỗi truy vấn tài khoản: ${listError.message}` };
  }
  const user = users?.find((u) => u.email === email);

  if (!user) {
    return { error: "Không tìm thấy thông tin đăng ký cho email này." };
  }

  if (user.email_confirmed_at) {
    return { success: true };
  }

  const userMetadata = user.user_metadata || {};
  const savedOtp = userMetadata.otp_code;
  const expiresAt = userMetadata.otp_expires_at;

  if (!savedOtp || !expiresAt) {
    return { error: "Không tìm thấy mã OTP. Vui lòng nhấn gửi lại mã." };
  }

  if (new Date() > new Date(expiresAt)) {
    return { error: "Mã OTP đã hết hạn. Vui lòng gửi lại mã mới." };
  }

  if (savedOtp !== otp) {
    return { error: "Mã OTP không chính xác. Vui lòng kiểm tra lại." };
  }

  // OTP matches and is valid! Let's confirm the user's email
  const { error: confirmError } = await admin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    user_metadata: {
      ...userMetadata,
      otp_code: null,
      otp_expires_at: null,
    },
  });

  if (confirmError) {
    return { error: `Kích hoạt tài khoản thất bại: ${confirmError.message}` };
  }

  return { success: true };
}

const resendOtpSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

export async function resendOtpAction(email: string) {
  const validation = resendOtpSchema.safeParse({ email });
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const admin = createAdminClient();

  // 1. Get user by email — dùng getUserByEmail trực tiếp
  const { data: { users }, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    return { error: `Lỗi truy vấn tài khoản: ${listError.message}` };
  }
  const user = users?.find((u) => u.email === email);

  if (!user) {
    return { error: "Không tìm thấy thông tin đăng ký cho email này." };
  }

  if (user.email_confirmed_at) {
    return { error: "Tài khoản này đã được xác thực và kích hoạt." };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`[DEVELOPMENT] Resend OTP for ${email}: ${otp}`);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

  const fullName = user.user_metadata?.full_name || email;

  // 2. Update user metadata with new OTP
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      otp_code: otp,
      otp_expires_at: expiresAt,
    },
  });

  if (updateError) {
    return { error: `Không thể tạo mã OTP mới: ${updateError.message}` };
  }

  // 3. Send email via SMTP
  const emailSubject = `[CoBuy] Gửi lại mã xác thực OTP đăng ký tài khoản`;
  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
      <h2 style="color: #0ea5e9; margin-top: 0; text-align: center;">Mã Xác Thực OTP Mới</h2>
      <p>Chào bạn <strong>${fullName}</strong>,</p>
      <p>Bạn đã yêu cầu gửi lại mã xác thực OTP cho tài khoản <strong>CoBuy</strong>. Mã mới của bạn là:</p>
      <div style="text-align: center; margin: 30px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0ea5e9; border: 2px dashed #0ea5e9; padding: 10px 20px; border-radius: 8px; display: inline-block;">${otp}</span>
      </div>
      <p style="color: #71717a; font-size: 14px; text-align: center;">Mã OTP này có hiệu lực trong vòng <strong>10 phút</strong>. Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
      <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
      <p style="color: #a1a1aa; font-size: 12px; text-align: center;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
    </div>
  `;

  try {
    await sendEmail({
      to: email,
      subject: emailSubject,
      html: emailHtml,
    });
  } catch (emailError) {
    console.error("Failed to send signup OTP email:", emailError);
    return { error: "Không thể gửi email xác thực OTP qua SMTP. Vui lòng kiểm tra lại cấu hình email." };
  }

  return { success: true };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { success: true };
}

export async function forgotPasswordAction(formData: z.infer<typeof forgotPasswordSchema>) {
  const validation = forgotPasswordSchema.safeParse(formData);
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const { email } = validation.data;
  const supabase = await createClient();

  // Supabase Auth SMTP configuration will send the email.
  // Next.js page /reset-password will handle password change upon clicking the redirect link.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function resetPasswordAction(formData: z.infer<typeof resetPasswordSchema>) {
  const validation = resetPasswordSchema.safeParse(formData);
  if (!validation.success) {
    return { error: validation.error.issues[0].message };
  }

  const { password } = validation.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
