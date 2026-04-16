import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { locales, defaultLocale } from './i18n/request';

const COOKIE_NAME = 'locale';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localeDetection: true,
  localePrefix: 'as-needed',
});

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Skip internal paths and static assets
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Root page and authenticated pages: cookie-based locale only, no URL prefix
  if (
    pathname === '/' ||
    pathname.startsWith('/portal') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/platform') ||
    pathname.startsWith('/dashboards') ||
    pathname.startsWith('/panoramica') ||
    pathname.startsWith('/company-pet') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/design-editor') ||
    pathname.startsWith('/403')
  ) {
    // Ensure locale cookie exists (detect from Accept-Language if missing)
    const existing = request.cookies.get(COOKIE_NAME)?.value;
    if (existing && locales.includes(existing as (typeof locales)[number])) {
      return NextResponse.next();
    }
    const acceptLanguage = request.headers.get('Accept-Language') ?? '';
    const locale = detectLocale(acceptLanguage);
    const response = NextResponse.next();
    response.cookies.set(COOKIE_NAME, locale, { path: '/', sameSite: 'lax' });
    return response;
  }

  // Public pages (landing, login, root): URL-based locale prefix
  return intlMiddleware(request) as NextResponse;
}

function detectLocale(acceptLanguage: string): string {
  for (const part of acceptLanguage.split(',')) {
    const lang = part.trim().split(';')[0].trim().toLowerCase().slice(0, 2);
    if (locales.includes(lang as (typeof locales)[number])) return lang;
  }
  return defaultLocale;
}

export const proxyConfig = {
  matcher: ['/((?!_next|api|favicon.ico|excalidraw-assets).*)'],
};
