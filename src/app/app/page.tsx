import { redirect } from "next/navigation";
import { getUserGroupsAction } from "@/app/actions/group.actions";
import { CreateFirstGroupForm } from "./create-first-group-form";
import { ShoppingBag } from "lucide-react";

export default async function AppPage() {
  // 1. Fetch groups this user is a member of
  const memberships = await getUserGroupsAction();

  // 2. If the user has groups, redirect to the first one's overview
  if (memberships.length > 0) {
    redirect(`/app/${memberships[0].groupId}/overview`);
  }

  // 3. Otherwise, render onboarding screen for creating the first group
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="bg-sky-500 p-3 rounded-2xl text-white shadow-lg shadow-sky-200">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-neutral-900">
            Chào mừng bạn đến với CoBuy
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            Để bắt đầu sử dụng, vui lòng tạo nhóm đầu tiên của bạn
          </p>
        </div>

        <div className="bg-white border border-neutral-100 shadow-xl shadow-neutral-100/50 rounded-3xl p-6">
          <CreateFirstGroupForm />
        </div>
      </div>
    </div>
  );
}
