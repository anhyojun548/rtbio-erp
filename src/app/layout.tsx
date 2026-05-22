import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SessionProvider } from "@/components/SessionProvider";
import { SharedUIProviders } from "@/components/shared/SharedUIProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "RTBIO ERP",
  description: "알티바이오 ERP — 멀티테넌트 SaaS ERP",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="ko">
      <body className="antialiased">
        <SessionProvider session={session}>
          {children}
          {/* 2026-05-22: 글로벌 UI (Toast / Dialog / FloatingPopup) */}
          <SharedUIProviders />
        </SessionProvider>
      </body>
    </html>
  );
}
