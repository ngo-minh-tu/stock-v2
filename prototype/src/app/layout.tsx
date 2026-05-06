import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';

import '@/styles/globals.css';

import { MswBootstrap } from '@/components/common/MswBootstrap';
import { AuthProvider } from '@/contexts/AuthContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { ThemeProvider, themeBootScript } from '@/contexts/ThemeContext';

const roboto = Roboto({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-roboto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Ngô Minh Tú — VN Real Estate AI Screener',
  description: 'Dữ liệu dẫn đường, quyết định thuộc về bạn',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: <html data-theme=...> is set by the inline boot script
    // before React hydrates, so the server-rendered attribute will not match.
    <html lang="vi" suppressHydrationWarning className={roboto.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <MswBootstrap>
          <LocaleProvider>
            <ThemeProvider>
              <AuthProvider>{children}</AuthProvider>
            </ThemeProvider>
          </LocaleProvider>
        </MswBootstrap>
      </body>
    </html>
  );
}
