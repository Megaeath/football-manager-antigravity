import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Breadcrumbs from "@/components/Breadcrumbs";
import { BreadcrumbProvider } from "@/components/BreadcrumbContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Football Manager Text Game",
  description: "A pure tactical football manager experience",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <BreadcrumbProvider>
          <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar />
            <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', display: 'flex', flexDirection: 'column' }}>
              <Header />
              <Breadcrumbs />
              <main style={{ padding: '24px', flex: 1 }}>
                {children}
              </main>
            </div>
          </div>
        </BreadcrumbProvider>
      </body>
    </html>
  );
}
