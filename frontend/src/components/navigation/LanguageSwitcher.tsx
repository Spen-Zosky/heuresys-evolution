'use client';

import { useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LOCALES = [
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
] as const;

type Locale = (typeof LOCALES)[number]['code'];

const LOCALE_PREFIXES = LOCALES.map((l) => `/${l.code}/`);

function setLocaleCookie(locale: Locale) {
  // 1 year persistence so preference survives logout/login (FE-031)
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `locale=${locale}; path=/; samesite=lax; max-age=${maxAge}`;
  document.cookie = `NEXT_LOCALE=${locale}; path=/; samesite=lax; max-age=${maxAge}`;
}

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Detect if we're on a URL-prefix route (e.g. /it/landing, /en/login)
  const isUrlPrefixRoute = LOCALE_PREFIXES.some((p) => pathname.startsWith(p));

  const handleSelect = (locale: Locale) => {
    setLocaleCookie(locale);
    startTransition(() => {
      if (isUrlPrefixRoute) {
        // Replace the locale segment in the URL
        const rest = pathname.replace(/^\/(it|en)\//, '/');
        router.push(`/${locale}${rest}`);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cambia lingua / Switch language"
          disabled={isPending}
        >
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {LOCALES.map(({ code, label, flag }) => (
          <DropdownMenuItem key={code} onClick={() => handleSelect(code)}>
            <span className="mr-2">{flag}</span>
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
