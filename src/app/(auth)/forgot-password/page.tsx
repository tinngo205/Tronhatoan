"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ShoppingBag, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { forgotPasswordAction } from "@/app/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

const forgotPasswordSchema = z.object({
  email: z.string().email("Email không đúng định dạng"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (values: ForgotPasswordFormValues) => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await forgotPasswordAction(values);
      if (res?.error) {
        setError(res.error);
      } else {
        setSuccess(true);
      }
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="bg-sky-500 p-3 rounded-2xl text-white shadow-lg shadow-sky-200">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-neutral-900">
            Khôi phục mật khẩu
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Nhập email của bạn và chúng tôi sẽ gửi liên kết để đặt lại mật khẩu mới
          </p>
        </div>

        <Card className="border border-neutral-100 shadow-xl shadow-neutral-100/50 rounded-3xl overflow-hidden">
          <CardHeader className="space-y-1 pb-4">
            <span className="text-xl font-bold text-neutral-800">Quên Mật Khẩu</span>
          </CardHeader>
          <CardContent className="grid gap-4">
            {error && (
              <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3.5 text-sm text-red-600 border border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-2xl bg-green-50 p-3.5 text-sm text-green-600 border border-green-100">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Đã gửi email khôi phục mật khẩu! Vui lòng kiểm tra hộp thư của bạn.</span>
              </div>
            )}

            {!success && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full rounded-2xl h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-bold transition-all shadow-md shadow-neutral-200 mt-4 flex items-center justify-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Gửi liên kết khôi phục
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-2 border-t border-neutral-50 bg-neutral-50/50 py-4 px-6 text-center text-sm text-neutral-500">
            <div>
              Quay lại{" "}
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
