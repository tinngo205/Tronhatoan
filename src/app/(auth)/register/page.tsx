"use client";

import { useState, useTransition, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ShoppingBag, Loader2, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { registerAction, verifyOtpAction, resendOtpAction, loginAction } from "@/app/actions/auth.actions";
import { acceptInvitationAction } from "@/app/actions/group.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

const registerSchema = z
  .object({
    email: z.string().email("Email không đúng định dạng"),
    password: z.string().min(6, "Mật khẩu phải dài ít nhất 6 ký tự"),
    confirmPassword: z.string(),
    fullName: z.string().min(2, "Tên hiển thị phải dài ít nhất 2 ký tự"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không trùng khớp",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Registration Form States
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // OTP Flow States
  const [showOtp, setShowOtp] = useState<boolean>(false);
  const [registeredEmail, setRegisteredEmail] = useState<string>("");
  const [registeredPassword, setRegisteredPassword] = useState<string>("");
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const [verifying, setVerifying] = useState<boolean>(false);
  const [cooldown, setCooldown] = useState<number>(0);

  useEffect(() => {
    const token = searchParams.get("invite_token");
    if (token) {
      setInviteToken(token);
    }
  }, [searchParams]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
    },
  });

  const onSubmit = (values: RegisterFormValues) => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await registerAction(values);
      if (res?.error) {
        setError(res.error);
        return;
      }

      setRegisteredEmail(values.email);
      setRegisteredPassword(values.password);
      setShowOtp(true);
      setCooldown(60);
    });
  };

  const handleVerifyOtp = async (otpString: string) => {
    setError(null);
    setVerifying(true);
    setSuccess(false);

    try {
      const verifyRes = await verifyOtpAction({ email: registeredEmail, otp: otpString });
      if (verifyRes?.error) {
        setError(verifyRes.error);
        setVerifying(false);
        return;
      }

      setSuccess(true);

      // Auto login
      const loginRes = await loginAction({ email: registeredEmail, password: registeredPassword });
      if (loginRes?.error) {
        setError(`Xác thực thành công nhưng lỗi tự động đăng nhập: ${loginRes.error}. Vui lòng đăng nhập lại thủ công.`);
        setVerifying(false);
        setTimeout(() => {
          router.push("/login");
        }, 3000);
        return;
      }

      // Check invitation
      if (inviteToken) {
        const inviteRes = await acceptInvitationAction(inviteToken);
        if (inviteRes?.error) {
          setError(`Đăng ký thành công nhưng lỗi chấp nhận lời mời: ${inviteRes.error}`);
          setTimeout(() => {
            router.push("/app");
            router.refresh();
          }, 3000);
        } else {
          router.push(`/app/${inviteRes.groupId}/overview`);
          router.refresh();
        }
      } else {
        router.push("/app");
        router.refresh();
      }
    } catch (e) {
      setError("Đã xảy ra lỗi khi xác thực OTP.");
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setError(null);
    setSuccess(false);
    
    const res = await resendOtpAction(registeredEmail);
    if (res?.error) {
      setError(res.error);
      return;
    }
    
    setSuccess(true);
    setCooldown(60);
    setOtp(new Array(6).fill("")); // reset input field
  };

  const handleOtpChange = (element: HTMLInputElement, index: number) => {
    if (isNaN(Number(element.value))) return;

    const val = element.value;
    const nextOtp = [...otp];
    nextOtp[index] = val ? val[val.length - 1] : "";
    setOtp(nextOtp);

    // Auto focus next
    if (val && element.nextSibling && element.nextSibling instanceof HTMLInputElement) {
      (element.nextSibling as HTMLInputElement).focus();
    }

    const otpString = nextOtp.join("");
    if (otpString.length === 6) {
      handleVerifyOtp(otpString);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      const nextOtp = [...otp];
      if (!otp[index] && index > 0) {
        nextOtp[index - 1] = "";
        setOtp(nextOtp);
        const target = e.currentTarget.previousSibling;
        if (target && target instanceof HTMLInputElement) {
          target.focus();
        }
      } else {
        nextOtp[index] = "";
        setOtp(nextOtp);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    if (!/^\d{6}$/.test(pastedData)) return;

    const nextOtp = pastedData.split("");
    setOtp(nextOtp);

    const inputs = e.currentTarget.parentElement?.getElementsByTagName("input");
    if (inputs && inputs.length === 6) {
      (inputs[5] as HTMLInputElement).focus();
    }

    handleVerifyOtp(pastedData);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="bg-sky-500 p-3 rounded-2xl text-white shadow-lg shadow-sky-200">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-neutral-900">
            {showOtp ? "Xác minh tài khoản" : "Tạo tài khoản mới"}
          </h2>
          {inviteToken ? (
            <p className="mt-2 text-sm text-sky-600 font-medium bg-sky-50 px-3 py-1 rounded-full border border-sky-100">
              Bạn đang đăng ký để tham gia nhóm qua lời mời
            </p>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">
              {showOtp 
                ? "Nhập mã OTP được gửi tới email của bạn" 
                : "Bắt đầu ghi chép chi tiêu và bữa ăn của nhóm bạn ngay hôm nay"}
            </p>
          )}
        </div>

        <Card className="border border-neutral-100 shadow-xl shadow-neutral-100/50 rounded-3xl overflow-hidden">
          <CardHeader className="space-y-1 pb-4">
            <span className="text-xl font-bold text-neutral-800">
              {showOtp ? "Xác thực OTP" : "Đăng Ký"}
            </span>
          </CardHeader>
          <CardContent className="grid gap-4">
            {error && (
              <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3.5 text-sm text-red-600 border border-red-100 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-2xl bg-green-50 p-3.5 text-sm text-green-600 border border-green-100">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>
                  {showOtp 
                    ? "Xác thực thành công! Đang đăng nhập..." 
                    : "Mã xác thực đã được gửi! Vui lòng kiểm tra hộp thư của bạn."}
                </span>
              </div>
            )}

            {showOtp ? (
              // OTP Form View
              <div className="space-y-6">
                <div className="text-sm text-neutral-600 text-center leading-relaxed">
                  Chúng tôi đã gửi mã xác thực gồm 6 chữ số đến email: <br />
                  <strong className="text-neutral-800">{registeredEmail}</strong>
                </div>

                <div className="flex justify-center gap-2.5 my-4">
                  {otp.map((data, index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength={1}
                      value={data}
                      onChange={(e) => handleOtpChange(e.target, index)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      onPaste={index === 0 ? handlePaste : undefined}
                      disabled={verifying}
                      className="w-12 h-14 text-center text-2xl font-bold border border-neutral-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none transition-all rounded-2xl bg-white text-neutral-800 shadow-sm"
                    />
                  ))}
                </div>

                <div className="flex flex-col items-center gap-4">
                  <Button
                    onClick={() => handleVerifyOtp(otp.join(""))}
                    disabled={verifying || otp.join("").length < 6}
                    className="w-full rounded-2xl h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-bold transition-all shadow-md shadow-neutral-200 flex items-center justify-center gap-2"
                  >
                    {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
                    Xác minh tài khoản
                  </Button>

                  <div className="text-sm text-center">
                    {cooldown > 0 ? (
                      <span className="text-neutral-400">
                        Gửi lại mã sau <strong className="text-neutral-600">{cooldown}s</strong>
                      </span>
                    ) : (
                      <button
                        onClick={handleResendOtp}
                        className="font-bold text-sky-500 hover:text-sky-600 transition-colors"
                      >
                        Gửi lại mã OTP
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setShowOtp(false);
                      setError(null);
                      setSuccess(false);
                    }}
                    className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 transition-colors mt-2"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Quay lại biểu mẫu đăng ký
                  </button>
                </div>
              </div>
            ) : (
              // Original Form View
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    Họ và tên
                  </label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Nguyễn Văn A"
                    disabled={isPending}
                    className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500 focus:ring-sky-500"
                    {...register("fullName")}
                  />
                  {errors.fullName && (
                    <span className="text-xs text-red-500 font-medium px-1">
                      {errors.fullName.message}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    Địa chỉ Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    disabled={isPending}
                    className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500 focus:ring-sky-500"
                    {...register("email")}
                  />
                  {errors.email && (
                    <span className="text-xs text-red-500 font-medium px-1">
                      {errors.email.message}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    Mật khẩu
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    disabled={isPending}
                    className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500 focus:ring-sky-500"
                    {...register("password")}
                  />
                  {errors.password && (
                    <span className="text-xs text-red-500 font-medium px-1">
                      {errors.password.message}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    Xác nhận mật khẩu
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    disabled={isPending}
                    className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500 focus:ring-sky-500"
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword && (
                    <span className="text-xs text-red-500 font-medium px-1">
                      {errors.confirmPassword.message}
                    </span>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full rounded-2xl h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-bold transition-all shadow-md shadow-neutral-200 mt-4 flex items-center justify-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Đăng ký tài khoản
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2 border-t border-neutral-50 bg-neutral-50/50 py-4 px-6 text-center text-sm text-neutral-500">
            <div>
              Đã có tài khoản?{" "}
              <Link href="/login" className="font-bold text-sky-500 hover:text-sky-600">
                Đăng nhập
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white">
          <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
