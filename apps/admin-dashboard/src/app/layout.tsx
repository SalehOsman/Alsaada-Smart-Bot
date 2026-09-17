import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { DashboardPreferencesProvider } from '@/components/providers/dashboard-preferences-provider';

export const metadata: Metadata = {
  title: 'منظومة السعادة سمارت بوت — لوحة التحكم المؤسسية',
  description: 'لوحة التحكم الإدارية والرقابة الميدانية المؤسسية لمنظومة السعادة سمارت بوت',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('alsaada_dashboard_preferences');
                  var theme = 'light';
                  if (stored) {
                    var parsed = JSON.parse(stored);
                    if (parsed && parsed.theme) theme = parsed.theme;
                  }
                  if (theme === 'system') {
                    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className="h-full font-sans antialiased bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
        suppressHydrationWarning
      >
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <DashboardPreferencesProvider>
          {children}
        </DashboardPreferencesProvider>
      </body>
    </html>
  );
}


