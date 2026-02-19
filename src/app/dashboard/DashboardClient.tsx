'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SavedSummary } from '@/lib/supabase/types';
import type { Database } from '@/lib/supabase/types';
import type { SummaryContext } from '@/lib/claude';
import type { SummaryContent } from '@/lib/summary-types';
import { getSummaryPreviewText } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Trash2, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as Sentry from '@sentry/nextjs';

const PAGE_SIZE = 20;

type SummaryRow = Database['public']['Tables']['summaries']['Row'];

/** Convert API response rows (date strings) into SavedSummary (Date objects). */
function deserializeSummary(row: SummaryRow): SavedSummary {
  return {
    id: row.id,
    title: row.title,
    summaries: row.summaries as unknown as SummaryContent,
    context: row.context as unknown as SummaryContext,
    transcripts: (row.transcripts as unknown as string[] | null) ?? null,
    selectedTags: row.selected_tags ?? null,
    shareToken: row.share_token ?? null,
    isShared: row.is_shared ?? false,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

interface DashboardClientProps {
  initialSummaries: SavedSummary[];
  totalCount: number;
}

export function DashboardClient({ initialSummaries, totalCount }: DashboardClientProps) {
  const [summaries, setSummaries] = useState(initialSummaries);
  const [total, setTotal] = useState(totalCount);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery]);

  // Execute server-side search when debounced query changes
  useEffect(() => {
    // Empty query = reset to initial server-rendered data
    if (debouncedQuery === '') {
      setSummaries(initialSummaries);
      setTotal(totalCount);
      return;
    }

    let cancelled = false;

    async function performSearch() {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          q: debouncedQuery,
          limit: String(PAGE_SIZE),
          offset: '0',
        });
        const res = await fetch(`/api/summaries?${params}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        if (!cancelled) {
          setSummaries((data.summaries as SummaryRow[]).map(deserializeSummary));
          setTotal(data.total);
        }
      } catch (err) {
        toast.error('Search failed');
        Sentry.captureException(err);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }

    performSearch();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, initialSummaries, totalCount]);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(summaries.length),
      });
      if (debouncedQuery) params.set('q', debouncedQuery);

      const res = await fetch(`/api/summaries?${params}`);
      if (!res.ok) throw new Error('Load more failed');
      const data = await res.json();
      const newSummaries = (data.summaries as SummaryRow[]).map(deserializeSummary);
      setSummaries((prev) => [...prev, ...newSummaries]);
      setTotal(data.total);
    } catch (err) {
      toast.error('Failed to load more summaries');
      Sentry.captureException(err);
    } finally {
      setLoadingMore(false);
    }
  }, [summaries.length, debouncedQuery]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this summary?')) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/summaries/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setSummaries((prev) => prev.filter((s) => s.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      toast.error('Failed to delete summary');
      Sentry.captureException(err);
    }
    setDeleting(null);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const hasMore = summaries.length < total;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Your library</h1>
        <p className="text-muted-foreground mt-1">
          {total} {total === 1 ? 'summary' : 'summaries'} saved
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search summaries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {summaries.length === 0 ? (
        <div className="text-center py-12">
          {total === 0 && !debouncedQuery ? (
            <>
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Nothing here yet</h2>
              <p className="text-muted-foreground mb-4">
                Once you create a summary, it&apos;ll show up here.
              </p>
              <Link href="/">
                <Button>Create your first</Button>
              </Link>
            </>
          ) : (
            <>
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No matches</h2>
              <p className="text-muted-foreground">Try different words?</p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summaries.map((summary) => (
              <Card
                key={summary.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => router.push(`/summary/${summary.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg line-clamp-2">{summary.title}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(summary.id);
                      }}
                      disabled={deleting === summary.id}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {getSummaryPreviewText(summary.summaries).replace(/[#*_]/g, '').slice(0, 200)}
                    ...
                  </p>
                  <p className="text-xs text-muted-foreground mt-3">
                    {formatDate(summary.createdAt)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 text-center">
              <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  `Load More (${summaries.length} of ${total})`
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
