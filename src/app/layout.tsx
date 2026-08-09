import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PWASegister } from "@/components/common/PWASegister";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CoBuy - Quản lý Chi tiêu & Bữa ăn Nhóm",
  description: "Ghi nhận đi chợ, điểm danh bữa ăn và quyết toán chi phí nhóm công bằng, tối ưu hóa giao dịch chuyển tiền.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CoBuy",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900" suppressHydrationWarning>
        <TooltipProvider>
          {children}
          <PWASegister />
        </TooltipProvider>
      </body>
    </html>
  );
}
