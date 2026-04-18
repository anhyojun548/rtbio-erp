import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RTBIO ERP",
  description: "알티바이오 ERP — 멀티테넌트 SaaS ERP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
