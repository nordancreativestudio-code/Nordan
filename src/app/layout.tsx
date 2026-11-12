import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Nordan · Painel", template: "%s · Nordan" },
  description: "Painel interno da Nordan Creative Studio",
  applicationName: "Nordan",
};

export const viewport: Viewport = {
  themeColor: "#02130F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>
        <div className="luzes" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
