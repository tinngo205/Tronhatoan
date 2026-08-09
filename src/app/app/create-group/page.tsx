import { redirect } from "next/navigation";
import { createClient } from "@/infrastructure/supabase/server";
import { CreateFirstGroupForm } from "../create-first-group-form";
import { ShoppingBag, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getUserGroupsAction } from "@/app/actions/group.actions";

export default async function CreateGroupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const memberships = await getUserGroupsAction();
  const backHref = memberships.length > 0 ? `/app/${memberships[0].groupId}/overview` : "/app";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </Link>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="bg-sky-500 p-3 rounded-2xl text-white shadow-lg shadow-sky-200">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-neutral-900">
            Tạo nhóm mới
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Tạo thêm nhóm mới để bắt đầu theo dõi chi tiêu và điểm danh
          </p>
        </div>

        <div className="bg-white border border-neutral-100 shadow-xl shadow-neutral-100/50 rounded-3xl p-6">
          <CreateFirstGroupForm />
        </div>
      </div>
    </div>
  );
}
