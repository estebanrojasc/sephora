import { Suspense } from "react";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";
import { SkeletonTable } from "@/components/common/Skeleton";
import { ensureAdminDynamicRender } from "@/lib/admin-dynamic-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export default async function AdminPage() {
  await ensureAdminDynamicRender();
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-10 w-64 skeleton rounded-lg" />
          <SkeletonTable rows={6} cols={7} />
        </div>
      }
    >
      <AdminDashboardClient />
    </Suspense>
  );
}
