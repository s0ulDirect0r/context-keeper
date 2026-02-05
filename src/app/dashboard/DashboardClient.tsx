'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { SavedSummary } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Trash2, FileText } from 'lucide-react';

interface DashboardClientProps {
  initialSummaries: SavedSummary[];
}

export function DashboardClient({ initialSummaries }: DashboardClientProps) {
  const [summaries, setSummaries] = useState(initialSummaries);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const filteredSummaries = summaries.filter((s) => {
    const query = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(query) ||
      s.summaries.some((summary) => summary.toLowerCase().includes(query))
    );
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this summary?')) return;

    setDeleting(id);
    const { error } = await supabase.from('summaries').delete().eq('id', id);

    if (error) {
      console.error('Failed to delete summary:', error);
      alert('Failed to delete summary');
    } else {
      setSummaries((prev) => prev.filter((s) => s.id !== id));
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Your Summaries</h1>
        <p className="text-muted-foreground mt-1">
          {summaries.length} saved {summaries.length === 1 ? 'summary' : 'summaries'}
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
        </div>

        {filteredSummaries.length === 0 ? (
          <div className="text-center py-12">
            {summaries.length === 0 ? (
              <>
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">No summaries yet</h2>
                <p className="text-muted-foreground mb-4">
                  Create your first summary to see it here.
                </p>
                <Link href="/">
                  <Button>Create Summary</Button>
                </Link>
              </>
            ) : (
              <>
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">No matching summaries</h2>
                <p className="text-muted-foreground">
                  Try a different search term.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSummaries.map((summary) => (
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
                    {summary.summaries[0]?.replace(/[#*_]/g, '').slice(0, 200)}...
                  </p>
                  <p className="text-xs text-muted-foreground mt-3">
                    {formatDate(summary.createdAt)}
                  </p>
                  {summary.themes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {summary.themes.slice(0, 3).map((theme) => (
                        <span
                          key={theme.id}
                          className="px-2 py-0.5 text-xs rounded-full bg-muted"
                        >
                          {theme.label}
                        </span>
                      ))}
                      {summary.themes.length > 3 && (
                        <span className="px-2 py-0.5 text-xs text-muted-foreground">
                          +{summary.themes.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
  );
}
