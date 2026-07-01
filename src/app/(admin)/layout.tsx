import { AdminRenderNonce } from "@/components/admin/AdminRenderNonce";
import { adminRenderNonce, ensureAdminDynamicRender } from "@/lib/admin-dynamic-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export default async function AdminRouteGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureAdminDynamicRender();
  return (
    <>
      <AdminRenderNonce nonce={adminRenderNonce()} />
      {children}
    </>
  );
}
