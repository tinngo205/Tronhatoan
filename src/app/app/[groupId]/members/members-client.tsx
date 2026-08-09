"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { GroupMember, GroupInvitation } from "@/core/entities";
import { inviteMemberAction, removeMemberAction, leaveGroupAction } from "@/app/actions/group.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  AlertCircle,
  Mail,
  UserMinus,
  CheckCircle,
  XCircle,
  Clock,
  UserPlus,
} from "lucide-react";

const inviteSchema = z.object({
  email: z.string().email("Địa chỉ email không đúng định dạng"),
  role: z.enum(["ADMIN", "MEMBER"]),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface MembersClientProps {
  groupId: string;
  members: GroupMember[];
  invitations: GroupInvitation[];
  currentUserId: string;
  currentUserRole: "ADMIN" | "MEMBER";
}

export function MembersClient({
  groupId,
  members,
  invitations,
  currentUserId,
  currentUserRole,
}: MembersClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Invite state
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<boolean>(false);

  // Kick modal state
  const [kickingMember, setKickingMember] = useState<GroupMember | null>(null);
  const [isKickOpen, setIsKickOpen] = useState(false);
  const [kickError, setKickError] = useState<string | null>(null);

  // Leave modal state
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const isAdmin = currentUserRole === "ADMIN";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: inviteErrors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      role: "MEMBER",
    },
  });

  const handleInviteSubmit = (values: InviteFormValues) => {
    setInviteError(null);
    setInviteSuccess(false);
    startTransition(async () => {
      const res = await inviteMemberAction({
        groupId,
        ...values,
      });

      if (res.error) {
        setInviteError(res.error);
        return;
      }

      setInviteSuccess(true);
      reset();
      router.refresh();
    });
  };

  const openKickModal = (member: GroupMember) => {
    setKickingMember(member);
    setKickError(null);
    setIsKickOpen(true);
  };

  const handleKickConfirm = () => {
    if (!kickingMember) return;
    setKickError(null);

    startTransition(async () => {
      const res = await removeMemberAction(groupId, kickingMember.memberId);
      if (res.error) {
        setKickError(res.error);
        return;
      }
      setIsKickOpen(false);
      router.refresh();
    });
  };

  const handleLeaveConfirm = () => {
    setLeaveError(null);

    startTransition(async () => {
      const res = await leaveGroupAction(groupId);
      if (res.error) {
        setLeaveError(res.error);
        return;
      }
      setIsLeaveOpen(false);
      router.push("/app");
      router.refresh();
    });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("vi-VN");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
            Thành viên nhóm
          </h1>
          <p className="text-sm text-neutral-500 font-medium">
            Quản lý vai trò, thêm lời mời tham gia và danh sách thành viên hoạt động
          </p>
        </div>
        <Button
          onClick={() => setIsLeaveOpen(true)}
          variant="outline"
          className="rounded-xl border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 font-bold self-start"
        >
          Rời nhóm
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Invite Form (Admins only) */}
        {isAdmin ? (
          <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white lg:col-span-1 h-fit">
            <CardHeader className="pb-3 border-b border-neutral-100/50">
              <CardTitle className="text-sm font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-sky-500" />
                Mời thành viên mới
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {inviteError && (
                <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3.5 text-sm text-red-600 border border-red-100">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{inviteError}</span>
                </div>
              )}

              {inviteSuccess && (
                <div className="flex items-center gap-2 rounded-2xl bg-green-50 p-3.5 text-sm text-green-600 border border-green-100">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Đã gửi email lời mời thành công!</span>
                </div>
              )}

              <form onSubmit={handleSubmit(handleInviteSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Email người nhận</label>
                  <Input
                    id="email"
                    placeholder="email@example.com"
                    disabled={isPending}
                    className="rounded-2xl h-11 border-neutral-200 focus:border-sky-500"
                    {...register("email")}
                  />
                  {inviteErrors.email && (
                    <span className="text-xs text-red-500 font-semibold px-1">{inviteErrors.email.message}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Vai trò trong nhóm</label>
                  <select
                    id="role"
                    disabled={isPending}
                    className="w-full rounded-2xl h-11 border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none font-medium"
                    {...register("role")}
                  >
                    <option value="MEMBER">Thành viên (Member)</option>
                    <option value="ADMIN">Quản trị viên (Admin)</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  disabled={isPending}
                  className="w-full rounded-2xl h-11 bg-neutral-900 hover:bg-neutral-800 text-white font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Gửi lời mời
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white lg:col-span-1 h-fit">
            <CardHeader className="pb-3 border-b border-neutral-100/50">
              <CardTitle className="text-sm font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-500" />
                Mời thành viên
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 text-sm text-neutral-400 font-medium text-center">
              Chỉ quản trị viên mới được phép mời thành viên mới vào nhóm. Vui lòng liên hệ với admin để gửi lời mời.
            </CardContent>
          </Card>
        )}

        {/* Right column: Active Members List & Invitation History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Members Card */}
          <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="pb-3 border-b border-neutral-100/50">
              <CardTitle className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                Thành viên hoạt động ({members.filter(m => m.status === 'ACTIVE').length})
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-neutral-100 p-0 px-6">
              {members
                .filter((m) => m.status === "ACTIVE")
                .map((member) => {
                  const isUser = member.memberId === currentUserId;
                  return (
                    <div key={member.id} className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-sm shrink-0">
                          {member.profile?.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-neutral-800">
                            {member.profile?.fullName} {isUser && "(Bạn)"}
                          </p>
                          <p className="text-xs text-neutral-400 font-semibold mt-0.5">
                            Tham gia ngày: {formatDate(member.joinedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          member.role === "ADMIN" ? "bg-purple-50 text-purple-600 border border-purple-100" : "bg-neutral-100 text-neutral-600"
                        }`}>
                          {member.role === "ADMIN" ? "ADMIN" : "MEMBER"}
                        </span>
                        {isAdmin && !isUser && (
                          <button
                            onClick={() => openKickModal(member)}
                            className="p-2 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors focus:outline-none"
                            title="Xóa thành viên"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>

          {/* Invitations History Card */}
          <Card className="border-neutral-100 shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="pb-3 border-b border-neutral-100/50">
              <CardTitle className="text-sm font-bold text-neutral-500 uppercase tracking-wider">
                Lịch sử lời mời
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-neutral-100 p-0 px-6">
              {invitations.length > 0 ? (
                invitations.map((inv) => {
                  let statusBadge = (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-100">
                      <Clock className="w-3 h-3" />
                      PENDING
                    </span>
                  );

                  if (inv.status === "ACCEPTED") {
                    statusBadge = (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <CheckCircle className="w-3 h-3" />
                        ĐÃ NHẬN
                      </span>
                    );
                  } else if (inv.status === "REVOKED") {
                    statusBadge = (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">
                        <XCircle className="w-3 h-3" />
                        THU HỒI
                      </span>
                    );
                  } else if (inv.status === "EXPIRED") {
                    statusBadge = (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                        <XCircle className="w-3 h-3" />
                        HẾT HẠN
                      </span>
                    );
                  }

                  return (
                    <div key={inv.id} className="flex items-center justify-between py-4">
                      <div>
                        <p className="text-sm font-bold text-neutral-800">{inv.email}</p>
                        <p className="text-[10px] text-neutral-400 font-semibold mt-0.5">
                          Vai trò mời: {inv.role}
                        </p>
                      </div>
                      <div className="shrink-0">{statusBadge}</div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-sm text-neutral-400 font-medium">
                  Chưa gửi lời mời nào.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Kick Confirmation Dialog */}
      <Dialog open={isKickOpen} onOpenChange={setIsKickOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-neutral-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Kích thành viên khỏi nhóm?
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500 mt-2">
              Bạn có chắc muốn kích thành viên <strong>"{kickingMember?.profile?.fullName}"</strong> khỏi nhóm không?
            </DialogDescription>
          </DialogHeader>

          {kickError && (
            <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-600 border border-red-100">
              <AlertCircle className="w-4 h-4" />
              <span>{kickError}</span>
            </div>
          )}

          <div className="text-xs font-semibold text-red-500 bg-red-50 p-3 rounded-2xl border border-red-100">
            Lưu ý: Hệ thống sẽ đánh dấu thành viên đã rời nhóm và giữ nguyên lịch sử hoạt động để đảm bảo việc chia tiền trong quá khứ được chính xác.
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              disabled={isPending}
              onClick={handleKickConfirm}
              className="rounded-2xl h-11 bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Xác nhận kích
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setIsKickOpen(false)}
              className="rounded-2xl h-11 border-neutral-200"
            >
              Hủy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Confirmation Dialog */}
      <Dialog open={isLeaveOpen} onOpenChange={setIsLeaveOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-neutral-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Xác nhận rời khỏi nhóm?
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500 mt-2">
              Bạn có chắc chắn muốn rời khỏi nhóm này không?
            </DialogDescription>
          </DialogHeader>

          {leaveError && (
            <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-600 border border-red-100">
              <AlertCircle className="w-4 h-4" />
              <span>{leaveError}</span>
            </div>
          )}

          <div className="text-xs font-semibold text-red-500 bg-red-50 p-3 rounded-2xl border border-red-100">
            Cảnh báo: Nếu bạn là Admin duy nhất, bạn phải trao quyền Admin cho thành viên khác trước khi có thể rời nhóm. Lịch sử chi tiêu và ăn uống của bạn sẽ được bảo toàn.
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              disabled={isPending}
              onClick={handleLeaveConfirm}
              className="rounded-2xl h-11 bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Xác nhận rời nhóm
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setIsLeaveOpen(false)}
              className="rounded-2xl h-11 border-neutral-200"
            >
              Hủy bỏ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
