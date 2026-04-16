'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function PeopleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 space-y-4">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/company-pet" className="hover:text-foreground transition-colors">
          Company PET
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Persone</span>
      </nav>
      {children}
    </div>
  );
}
