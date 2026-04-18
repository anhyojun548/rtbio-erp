import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SessionProvider } from "@/components/SessionProvider";
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
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
