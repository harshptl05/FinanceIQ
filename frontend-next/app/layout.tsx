import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { LivePricesProvider } from '@/lib/live-prices';
import { ChartModeProvider } from '@/lib/chart-mode';
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
    <html lang="en" className="bg-white">
      <body className="font-sans antialiased bg-white text-gray-900">
        <AuthProvider>
          <LivePricesProvider>
            <ChartModeProvider>{children}</ChartModeProvider>
          </LivePricesProvider>
        </AuthProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
