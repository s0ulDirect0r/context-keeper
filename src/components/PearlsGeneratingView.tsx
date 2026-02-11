'use client';

import { useState, useEffect } from 'react';
import { Gem } from 'lucide-react';

const MINING_MESSAGES = [
  'Reading between the lines…',
  'Finding what resonated…',
  'Connecting the threads…',
  'Surfacing insights…',
  'Crafting your pearls…',
];

// Cycle interval in ms
const MESSAGE_INTERVAL = 2800;

/**
 * Shown in the sidebar while pearl generation is in progress.
 * Rotating status messages + skeleton pearl cards that fill in staggered.
 */
export function PearlsGeneratingView({ selectedTags }: { selectedTags?: string[] }) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MINING_MESSAGES.length);
    }, MESSAGE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-950/20 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Gem className="h-4 w-4 text-amber-500 animate-pulse" />
        <h3 className="font-semibold text-sm tracking-wide uppercase text-amber-900 dark:text-amber-200">
          Mining pearls
        </h3>
      </div>

      {/* Selected tags reminder */}
      {selectedTags && selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Rotating message */}
      <p
        key={messageIndex}
        className="text-xs text-amber-700/80 dark:text-amber-400/70 italic animate-in fade-in duration-500"
      >
        {MINING_MESSAGES[messageIndex]}
      </p>

      {/* Skeleton pearl cards */}
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <SkeletonPearlCard key={i} delay={i * 400} />
        ))}
      </div>
    </div>
  );
}

function SkeletonPearlCard({ delay }: { delay: number }) {
  const [visible, setVisible] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!visible) return null;

  return (
    <div className="rounded-lg border border-amber-200/60 dark:border-amber-800/20 bg-white/80 dark:bg-amber-950/20 shadow-sm p-3 space-y-2.5 animate-in fade-in duration-500">
      {/* Quote skeleton */}
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-amber-200/50 dark:bg-amber-800/30 animate-pulse" />
        <div className="h-3 w-4/5 rounded bg-amber-200/50 dark:bg-amber-800/30 animate-pulse" />
      </div>
      {/* Speaker skeleton */}
      <div className="h-2.5 w-20 rounded bg-amber-200/30 dark:bg-amber-800/20 animate-pulse" />
      {/* Insight skeleton */}
      <div className="h-2.5 w-3/4 rounded bg-amber-100/60 dark:bg-amber-900/20 animate-pulse" />
      {/* Tag pills skeleton */}
      <div className="flex gap-1.5">
        <div className="h-4 w-16 rounded-full bg-amber-100/80 dark:bg-amber-900/25 animate-pulse" />
        <div className="h-4 w-12 rounded-full bg-amber-100/80 dark:bg-amber-900/25 animate-pulse" />
      </div>
    </div>
  );
}
