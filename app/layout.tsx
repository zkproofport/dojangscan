import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dojang Scan · GIWA Attestation Explorer",
  description: "GIWA Sepolia의 실제 Dojang 기록을 탐색하고 ZKProofport로 필요한 사실을 증명하세요.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
