'use client';

/**
 * GlobalSearchDialog — Cmd+K / Ctrl+K command palette
 *
 * Opens via keyboard shortcut or button click. Lists pages from RBP nav
 * (already filtered by user role) and lets the user fuzzy-filter and navigate.
 * FE-053 fix.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useSidebarNav } from '@/lib/hooks/use-sidebar-nav';

interface FlatItem {
  label: string;
  href: string;
  section: string;
}

export function GlobalSearchDialog() {
  const router = useRouter();
  const t = useTranslations('nav');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const sections = useSidebarNav();

  const items: FlatItem[] = useMemo(() => {
    const flat: FlatItem[] = [];
    for (const sec of sections) {
      for (const it of sec.items) {
        flat.push({ label: it.label, href: it.href, section: sec.title });
      }
    }
    return flat;
  }, [sections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.section.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Listen for custom event from other components (e.g. search button click)
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('global-search:open', handler);
    return () => window.removeEventListener('global-search:open', handler);
  }, []);

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const goto = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const placeholder = locale === 'en' ? 'Search pages, sections...' : 'Cerca pagine, sezioni...';
  const noResults = locale === 'en' ? 'No matches' : 'Nessun risultato';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl p-0 gap-0">
        <DialogTitle className="sr-only">{t('search')}</DialogTitle>
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 mr-2 text-muted-foreground" aria-hidden="true" />
          <Input
            autoFocus
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 shadow-none"
          />
          <kbd className="ml-2 text-xs text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">{noResults}</div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((it) => (
                <li key={it.href}>
                  <button
                    type="button"
                    onClick={() => goto(it.href)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground text-left"
                  >
                    <span className="text-sm">{it.label}</span>
                    <span className="text-xs text-muted-foreground">{it.section}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
