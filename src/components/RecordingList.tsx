'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import type { Recording } from '@/lib/otter';

interface Props {
  recordings: Recording[];
  onSelect: (recordingIds: string[]) => void;
  onBack: () => void;
  loading?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getDateGroup(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekAgo) return 'This Week';
  if (date >= twoWeeksAgo) return 'Last Week';
  return 'Older';
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

interface GroupedRecordings {
  label: string;
  recordings: Recording[];
}

function groupByDate(recordings: Recording[]): GroupedRecordings[] {
  const groups = new Map<string, Recording[]>();
  const order = ['Today', 'Yesterday', 'This Week', 'Last Week', 'Older'];

  for (const rec of recordings) {
    const group = getDateGroup(rec.createdAt);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(rec);
  }

  return order
    .filter((label) => groups.has(label))
    .map((label) => ({ label, recordings: groups.get(label)! }));
}

export function RecordingList({ recordings, onSelect, onBack, loading }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const toggleSelection = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleContinue = () => {
    onSelect(Array.from(selected));
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = q ? recordings.filter((r) => r.title.toLowerCase().includes(q)) : recordings;
    return groupByDate(list);
  }, [recordings, search]);

  const totalFiltered = filtered.reduce((sum, g) => sum + g.recordings.length, 0);

  return (
    <div className="w-full max-w-[34rem] mx-auto flex flex-col gap-3">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Which recordings should I look at?
        </h2>
        <p className="text-muted-foreground">
          Pick one or more and I&apos;ll pull the transcripts.
        </p>
      </div>

      {recordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          {loading ? (
            <>
              <div className="relative mb-4">
                <div className="h-8 w-8 rounded-full border-4 border-muted" />
                <div className="absolute top-0 left-0 h-8 w-8 rounded-full border-4 border-t-primary animate-spin" />
              </div>
              <p className="text-muted-foreground">Fetching your recordings...</p>
            </>
          ) : (
            <p className="text-muted-foreground">
              I couldn&apos;t find any recordings. Try reconnecting your Otter account.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search recordings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            />
          </div>

          {/* Recording list */}
          <div className="max-h-[32rem] overflow-y-auto">
            {totalFiltered === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No recordings match &ldquo;{search}&rdquo;
              </p>
            ) : (
              filtered.map((group) => (
                <div key={group.label}>
                  <div className="px-2 pt-3 pb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {group.recordings.map((recording) => {
                      const isSelected = selected.has(recording.id);
                      return (
                        <div
                          key={recording.id}
                          className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-primary/40 bg-card'
                              : 'border-border/40 hover:border-border hover:bg-card'
                          }`}
                          onClick={() => toggleSelection(recording.id)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelection(recording.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 shrink-0 rounded border-border accent-primary mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{recording.title}</span>
                            <p className="text-sm text-muted-foreground">
                              {group.label === 'Today' || group.label === 'Yesterday'
                                ? formatTime(recording.createdAt)
                                : formatShortDate(recording.createdAt)}
                              {' · '}
                              {formatDuration(recording.duration)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Sticky footer */}
      <div className="sticky bottom-0 flex items-center gap-3 pt-2 pb-4 border-t border-border bg-background">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        {selected.size > 0 && (
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
        )}
        <Button
          className="flex-1"
          onClick={handleContinue}
          disabled={selected.size === 0 || loading}
        >
          {loading
            ? 'Loading...'
            : selected.size === 0
              ? 'Select recordings above'
              : `Let\u2019s go with ${selected.size === 1 ? 'this one' : `these ${selected.size}`}`}
        </Button>
      </div>
    </div>
  );
}
