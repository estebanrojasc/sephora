import { RecordDetailPageClient } from "@/components/admin/record-detail/RecordDetailPageClient";
import { ensureAdminDynamicRender } from "@/lib/admin-dynamic-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensureAdminDynamicRender();
  const { id } = await params;
  return <RecordDetailPageClient id={id} />;
}
