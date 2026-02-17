'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-3xl font-bold mb-4">Couldn&apos;t load your library</h1>
      <p className="text-muted-foreground mb-8">
        Something went wrong loading your summaries. This might be a temporary issue.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/">
          <Button variant="outline">Go home</Button>
        </Link>
      </div>
    </main>
  );
}
