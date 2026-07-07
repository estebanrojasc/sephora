import { BitacoraDatePageClient } from "@/components/admin/bitacora/BitacoraDatePageClient";
import { ensureAdminDynamicRender } from "@/lib/admin-dynamic-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export default async function BitacoraDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  await ensureAdminDynamicRender();
  const { date } = await params;
  return <BitacoraDatePageClient date={decodeURIComponent(date)} />;
}
