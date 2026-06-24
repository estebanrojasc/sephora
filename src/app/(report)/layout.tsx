/**
 * Layout vacío del grupo (report). El root layout (`app/layout.tsx`) ya
 * provee el `<html>`, fuentes y AppProviders; aquí solo nos aseguramos de
 * NO heredar el shell admin (sidebar + header), porque la ruta debe ser
 * imprimible y autocontenida.
 */
export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
