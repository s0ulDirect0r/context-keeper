'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Error({
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
      <h1 className="text-3xl font-bold mb-4">Something went wrong</h1>
      {process.env.NODE_ENV === 'development' && (
        <pre className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-4 rounded-md mb-6 max-w-xl mx-auto text-left overflow-auto">
          {error.message}
        </pre>
      )}
      <p className="text-muted-foreground mb-8">
        An unexpected error occurred. You can try again or head back home.
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
