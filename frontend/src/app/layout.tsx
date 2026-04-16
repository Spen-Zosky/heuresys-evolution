import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Sora, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { ErrorProviderWrapper } from '@/components/providers/error-provider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import { QueryProvider } from '@/providers/query-provider';

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
});

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Heuresys — Organizational Intelligence & Workforce Orchestration',
  description:
    'Il layer mancante tra ERP, HR e BI. Knowledge Graph ESCO, career intelligence e workforce orchestration.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${plusJakartaSans.variable} ${sora.variable} ${jetbrainsMono.variable} antialiased font-sans`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
            <ThemeProvider defaultTheme="dark">
              <ErrorBoundary>
                <ErrorProviderWrapper>
                  {children}
                  <SessionTimeoutWarning />
                </ErrorProviderWrapper>
              </ErrorBoundary>
            </ThemeProvider>
          </QueryProvider>
        </NextIntlClientProvider>
        {/* Excalidraw font asset path - MUST be set before Excalidraw loads */}
        <Script
          id="excalidraw-asset-path"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.EXCALIDRAW_ASSET_PATH = "/excalidraw-assets/";`,
          }}
        />
      </body>
    </html>
  );
}
