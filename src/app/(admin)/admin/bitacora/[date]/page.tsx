import { BitacoraDatePageClient } from "@/components/admin/bitacora/BitacoraDatePageClient";
import {
  adminPageSegmentConfig,
  ensureAdminDynamicRender,
} from "@/lib/admin-dynamic-page";

export const dynamic = adminPageSegmentConfig.dynamic;
export const revalidate = adminPageSegmentConfig.revalidate;
export const fetchCache = adminPageSegmentConfig.fetchCache;

export default async function BitacoraDatePage() {
  await ensureAdminDynamicRender();
  return <BitacoraDatePageClient />;
}
