import type { Metadata } from "next";
import "./globals.css";
import "@assistant-ui/react/styles/index.css";

export const metadata: Metadata = {
  title: "Fablab AI Assistant",
  description: "Assistant IA auto-hébergé pour le fablab",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        {children}
      </body>
    </html>
  );
}
