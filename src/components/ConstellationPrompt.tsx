'use client';

import Link from 'next/link';
import { Compass } from 'lucide-react';

interface ConstellationPromptProps {
  summaryId: string;
  pearlCount: number;
}

/**
 * Appears in the summary sidebar after pearls are curated.
 * Links to the constellation view with the current summary highlighted.
 * Returns null when there are no pearls to show.
 */
export function ConstellationPrompt({ summaryId, pearlCount }: ConstellationPromptProps) {
  if (pearlCount === 0) return null;

  const href = `/constellation?highlight=${encodeURIComponent(summaryId)}&surface=true`;

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Compass className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h3 className="font-semibold text-sm tracking-wide uppercase text-emerald-900 dark:text-emerald-200">
          Constellation
        </h3>
      </div>
      <p className="text-xs text-emerald-700/70 dark:text-emerald-400/60">
        Decisions are ready &mdash; view in your constellation
      </p>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 underline-offset-2 hover:underline transition-colors"
      >
        View decisions from {pearlCount} pearl{pearlCount === 1 ? '' : 's'}
      </Link>
    </div>
  );
}
