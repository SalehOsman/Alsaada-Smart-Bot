import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'منظومة السعادة سمارت بوت — لوحة التحكم المؤسسية',
  description: 'لوحة التحكم الإدارية والرقابة الميدانية المؤسسية لمنظومة السعادة سمارت بوت',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full" suppressHydrationWarning>
      <body
        className="h-full font-sans antialiased bg-slate-50 text-slate-900"
        suppressHydrationWarning
      >
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}

