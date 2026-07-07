import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { APP_TITLE, BRAND_LOGO_SRC } from "@/lib/constants";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const outfitDisplay = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_TITLE,
  description:
    "Captura de documentos manuscritos y revisión con extracción IA bajo demanda.",
  icons: {
    icon: BRAND_LOGO_SRC,
    apple: BRAND_LOGO_SRC,
  },
};

/** Safe areas iOS (viewport-fit=cover) y escala inicial explícita. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${jakartaSans.variable} ${outfitDisplay.variable} ${jetMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
