import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { LivePricesProvider } from '@/lib/live-prices';
import { ChartModeProvider } from '@/lib/chart-mode';
import { ThemeProvider, THEME_PRELOAD_SCRIPT } from '@/lib/theme-context';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'FinanceIQ — Your AI Portfolio Advisor',
  description:
    'A modern AI portfolio advisor for everyday investors. Watch your money 24/7, understand risk, and rebalance with confidence.',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the dark/light class BEFORE hydration so users with dark
         *  mode enabled don't see a single bright-white frame on load. */}
        <script
          dangerouslySetInnerHTML={{ __html: THEME_PRELOAD_SCRIPT }}
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <ThemeProvider>
          <AuthProvider>
            <LivePricesProvider>
              <ChartModeProvider>{children}</ChartModeProvider>
            </LivePricesProvider>
          </AuthProvider>
          <Toaster richColors position="top-right" theme="system" />
        </ThemeProvider>
      </body>
    </html>
  );
}
