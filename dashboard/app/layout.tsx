import type { Metadata } from "next";
import { headers } from "next/headers";
import { Nav } from "../components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Painel Operacional - Integração J&T",
  description: "Dashboard interno para monitorar e reprocessar pedidos da integração TOTVS x J&T.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = (await headers()).get("x-next-pathname") ?? "/";

  return (
    <html lang="pt-BR">
      <body>
        <div className="app-shell">
          <Nav pathname={pathname} />
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
