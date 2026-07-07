import { ReportePageClient } from "@/features/pdf/ReportePageClient";

export default async function ReportePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReportePageClient id={id} />;
}
