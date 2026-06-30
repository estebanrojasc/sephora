import {
  adminPageSegmentConfig,
  ensureAdminDynamicRender,
} from "@/lib/admin-dynamic-page";

export const dynamic = adminPageSegmentConfig.dynamic;
export const revalidate = adminPageSegmentConfig.revalidate;
export const fetchCache = adminPageSegmentConfig.fetchCache;

export default async function BitacoraLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureAdminDynamicRender();
  return children;
}
