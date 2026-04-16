'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2 } from 'lucide-react';

// ============================================
// INTENT DETECTION
// ============================================

export type Intent =
  | 'FIND_PEOPLE'
  | 'CAREER_TRANSITION'
  | 'GAP_ANALYSIS'
  | 'SIMILAR_SKILLS'
  | 'FIND_OCCUPATIONS'
  | 'CONCENTRATION_RISK';

export interface DetectedIntent {
  intent: Intent;
  params: Record<string, string>;
}

export function detectIntent(query: string): DetectedIntent {
  const q = query.toLowerCase().trim();

  // "chi sa/conosce X" -> FIND_PEOPLE
  const findPeopleMatch = q.match(/(?:chi\s+(?:sa|conosce|ha)\s+(?:fare\s+)?)(.*)/i);
  if (findPeopleMatch)
    return {
      intent: 'FIND_PEOPLE',
      params: { skill: findPeopleMatch[1].trim() },
    };

  // "da X a Y", "transizione da X a Y", "come passo da X a Y"
  const transitionMatch = q.match(/(?:da\s+)(.*?)(?:\s+a\s+)(.*)/i);
  if (transitionMatch)
    return {
      intent: 'CAREER_TRANSITION',
      params: {
        source: transitionMatch[1].trim(),
        target: transitionMatch[2].trim(),
      },
    };

  // "cosa mi manca per X", "gap per X"
  const gapMatch = q.match(
    /(?:cosa\s+(?:mi\s+)?manca\s+per\s+|gap\s+(?:per\s+|analysis\s+)?)(.*)/i
  );
  if (gapMatch)
    return {
      intent: 'GAP_ANALYSIS',
      params: { occupation: gapMatch[1].trim() },
    };

  // "simili a X", "come X"
  const similarMatch = q.match(/(?:simili?\s+a\s+|come\s+)(.*)/i);
  if (similarMatch)
    return {
      intent: 'SIMILAR_SKILLS',
      params: { skill: similarMatch[1].trim() },
    };

  // "rischio", "critiche", "concentrazione"
  if (/rischio|critich[eio]|concentrazione|vulnerabil/i.test(q))
    return { intent: 'CONCENTRATION_RISK', params: {} };

  // Default: occupation search
  return { intent: 'FIND_OCCUPATIONS', params: { query: query.trim() } };
}

// ============================================
// SUGGESTION CHIPS
// ============================================

const SUGGESTIONS = [
  'Skill critiche',
  'Career path per me',
  'Gap analysis IT',
  'Chi sa fare Python?',
  'Occupazioni finanza',
];

// ============================================
// SEARCH BAR COMPONENT
// ============================================

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

export function SearchBar({ onSearch, isLoading = false }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const debouncedSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim()) return;

      debounceRef.current = setTimeout(() => {
        onSearch(value.trim());
      }, 300);
    },
    [onSearch]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  }

  function handleChip(chip: string) {
    setQuery(chip);
    onSearch(chip);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && query.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onSearch(query.trim());
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Search input — Spotlight/Raycast style */}
      <div className="relative group">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
        <div className="relative flex items-center rounded-xl border bg-background shadow-lg ring-1 ring-transparent focus-within:ring-2 focus-within:ring-primary/50 focus-within:shadow-xl transition-all duration-200">
          {isLoading ? (
            <Loader2 className="absolute left-4 h-5 w-5 text-muted-foreground animate-spin" />
          ) : (
            <Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
          )}
          <Input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Cerca skill, occupazioni, career path, gap analysis..."
            className="h-14 pl-12 pr-4 text-base border-0 shadow-none focus-visible:ring-0 bg-transparent"
          />
        </div>
      </div>

      {/* Suggestion chips */}
      <div className="flex flex-wrap gap-2 justify-center">
        {SUGGESTIONS.map((chip) => (
          <Badge
            key={chip}
            variant="secondary"
            className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors px-3 py-1 text-xs"
            onClick={() => handleChip(chip)}
          >
            {chip}
          </Badge>
        ))}
      </div>
    </div>
  );
}
