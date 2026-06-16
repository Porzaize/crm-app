import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";

const appFont = IBM_Plex_Sans_Thai({
  weight: ["400", "500", "600", "700"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-app",
  // ปิด synthetic fallback ที่อิง Arial (จัดตำแหน่งสระ/วรรณยุกต์ไทยผิด → "สระลอย"
  // ตอนยังโหลดฟอนต์ไม่เสร็จ) แล้วใช้ฟอนต์ที่รองรับไทยถูกต้องแทน
  adjustFontFallback: false,
  fallback: ["Leelawadee UI", "Tahoma", "Noto Sans Thai", "Segoe UI", "sans-serif"],
});

export const metadata: Metadata = {
  title: "CRM โทรติดตามลูกค้า",
  description: "ระบบโทรติดตามลูกค้าขาดฝาก",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // กันจอกระพริบ: ตั้ง data-theme บน <html> ก่อน paint จาก localStorage หรือค่าระบบเครื่อง
  const themeScript = `(function(){try{var t=localStorage.getItem('crm-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

  return (
    <html lang="th" className={appFont.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
