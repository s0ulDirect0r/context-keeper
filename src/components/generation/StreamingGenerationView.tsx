'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface Props {
  markdown: string;
  isStreaming: boolean;
  error?: string | null;
  onCancel?: () => void;
  onRetry?: () => void;
}

export function StreamingGenerationView({
  markdown,
  isStreaming,
  error,
  onCancel,
  onRetry,
}: Props) {
  if (error) {
    return (
      <div className="w-full max-w-3xl mx-auto">
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="rounded-full bg-red-100 dark:bg-red-950 p-3">
            <X className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold">Generation failed</h3>
          <p className="text-muted-foreground text-center max-w-md">{error}</p>
          <div className="flex gap-3">
            {onRetry && <Button onClick={onRetry}>Try again</Button>}
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Go back
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      {markdown ? (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
          {isStreaming && (
            <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <div className="relative">
            <div className="h-8 w-8 rounded-full border-4 border-muted" />
            <div className="absolute top-0 left-0 h-8 w-8 rounded-full border-4 border-t-primary animate-spin" />
          </div>
          <p className="text-muted-foreground">Reading through your transcript...</p>
        </div>
      )}
      {onCancel && (isStreaming || !markdown) && (
        <div className="flex justify-center mt-6">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
