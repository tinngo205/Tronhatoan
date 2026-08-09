"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Group, GroupSettings } from "@/core/entities";
import { updateGroupAction } from "@/app/actions/group.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertCircle, CheckCircle, Settings, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const settingsSchema = z.object({
  name: z.string().min(2, "Tên nhóm phải dài ít nhất 2 ký tự"),
  allocationMode: z.enum(["DAILY", "MEAL"]),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

interface SettingsClientProps {
  groupId: string;
  group: Group;
}

export function SettingsClient({ groupId, group }: SettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: group.name,
      allocationMode: group.settings.allocationMode || "DAILY",
    },
  });

  const onSubmit = (values: SettingsFormValues) => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const updatedSettings: GroupSettings = {
        allocationMode: values.allocationMode,
      };

      const res = await updateGroupAction(groupId, values.name, updatedSettings, group.version);

      if (res.error) {
        setError(res.error);
        return;
      }

      setSuccess(true);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-neutral-700" />
          Cài đặt nhóm
        </h1>
        <p className="text-sm text-neutral-500 font-medium mt-1">
          Quản lý các cấu hình cốt lõi và phương pháp phân bổ chi phí của nhóm bạn
        </p>
      </div>

      <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white">
        <CardHeader className="pb-3 border-b border-neutral-100/50">
          <CardTitle className="text-sm font-bold text-neutral-700">Thông tin cơ bản & Cách phân bổ</CardTitle>
          <CardDescription className="text-xs">
            Thay đổi cấu hình nhóm. Mọi thay đổi sẽ áp dụng trực tiếp cho các kỳ quyết toán đang mở.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl bg-red-50 p-3.5 text-sm text-red-600 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl bg-green-50 p-3.5 text-sm text-green-600 border border-green-100">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Cập nhật cấu hình nhóm thành công!</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Group Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Tên nhóm</label>
              <Input
                id="name"
                disabled={isPending}
                className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500"
                {...register("name")}
              />
              {errors.name && (
                <span className="text-xs text-red-500 font-semibold px-1">{errors.name.message}</span>
              )}
            </div>

            {/* Allocation Mode Segmented Control */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Chế độ phân bổ chi phí bữa ăn
                </label>
                <Tooltip>
                  <TooltipTrigger className="text-neutral-400 hover:text-neutral-500 focus:outline-none cursor-pointer">
                    <HelpCircle className="w-3.5 h-3.5" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs rounded-xl text-xs leading-relaxed p-3 shadow-md border-neutral-100">
                    <p className="font-bold mb-1">Cách chia tiền ăn:</p>
                    <p className="mb-1"><strong>Daily Mode:</strong> Một người ăn ít nhất 1 bữa trong ngày sẽ chịu 1 phần chi phí đi chợ của ngày đó.</p>
                    <p><strong>Meal Mode:</strong> Mỗi bữa ăn được tính là 1 phần riêng biệt (Sáng + Trưa + Tối = 3 phần). Chi phí được phân bổ theo tỷ lệ số bữa ăn.</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <Controller
                name="allocationMode"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* DAILY mode card */}
                    <button
                      type="button"
                      onClick={() => field.onChange("DAILY")}
                      className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all relative focus:outline-none ${
                        field.value === "DAILY"
                          ? "border-sky-500 bg-sky-50/20 shadow-sm"
                          : "border-neutral-100 bg-white hover:bg-neutral-50"
                      }`}
                    >
                      <span className="font-bold text-sm text-neutral-800">Daily Mode (Theo người ăn)</span>
                      <span className="text-xs text-neutral-400 mt-1 leading-relaxed">
                        Một người ăn trong ngày = 1 phần. Bất kể ăn sáng, trưa hay tối, chi phí đi chợ của ngày được chia đều cho những người có mặt.
                      </span>
                    </button>

                    {/* MEAL mode card */}
                    <button
                      type="button"
                      onClick={() => field.onChange("MEAL")}
                      className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all relative focus:outline-none ${
                        field.value === "MEAL"
                          ? "border-sky-500 bg-sky-50/20 shadow-sm"
                          : "border-neutral-100 bg-white hover:bg-neutral-50"
                      }`}
                    >
                      <span className="font-bold text-sm text-neutral-800">Meal Mode (Theo bữa ăn)</span>
                      <span className="text-xs text-neutral-400 mt-1 leading-relaxed">
                        Mỗi bữa ăn = 1 phần. Ai ăn nhiều bữa chịu nhiều tiền hơn. Chi phí ngày được chia theo tổng số bữa ăn thực tế (Ví dụ: Sáng=1, Trưa=1, Tối=1).
                      </span>
                    </button>
                  </div>
                )}
              />
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="rounded-2xl h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-bold transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Lưu cấu hình nhóm
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
