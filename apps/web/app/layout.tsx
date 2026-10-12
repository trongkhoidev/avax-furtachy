import type { Metadata } from "next";
import { ClientProviders } from "@/app/components/client-providers";
import { SiteHeader } from "@/app/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "WolfDAO — treasury decisions by markets",
  description: "Launch projects, join Fuji testnet raises, and govern with conditional markets on Avalanche.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try { var savedTheme = localStorage.getItem("wolfdao-theme"); var theme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark"; document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; } catch (_) { document.documentElement.dataset.theme = "dark"; }`,
          }}
        />
      </head>
      <body>
        <ClientProviders>
        <SiteHeader />
        <main>{children}</main>
        </ClientProviders>
        <footer className="site-footer">
          <div className="container footer-inner">
            <span>WolfDAO · Avalanche Fuji · chainId 43113</span>
            <span>Avalanche Fuji Testnet · Verified on-chain contracts and real-time event indexing.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
