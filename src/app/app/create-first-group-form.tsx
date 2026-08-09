"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, AlertCircle } from "lucide-react";
import { createGroupAction } from "@/app/actions/group.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  name: z.string().min(2, "Tên nhóm phải dài ít nhất 2 ký tự"),
});

type FormValues = z.infer<typeof schema>;

export function CreateFirstGroupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    setError(null);
    startTransition(async () => {
      const res = await createGroupAction(values);
      if (res?.error) {
        setError(res.error);
      } else if (res?.group) {
        router.push(`/app/${res.group.id}/overview`);
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3.5 text-sm text-red-600 border border-red-100">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
          Tên nhóm của bạn
        </label>
        <Input
          id="name"
          placeholder="Nhà Trọ Thân Yêu, Gia Đình Nhỏ, Nhóm Du Lịch..."
          disabled={isPending}
          className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500 focus:ring-sky-500"
          {...register("name")}
        />
        {errors.name && (
          <span className="text-xs text-red-500 font-medium px-1">
            {errors.name.message}
          </span>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-bold transition-all shadow-md shadow-neutral-200 flex items-center justify-center gap-2"
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Tạo nhóm mới
      </Button>
    </form>
  );
}
