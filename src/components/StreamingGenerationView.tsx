'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  markdown: string;
  isStreaming: boolean;
}

export function StreamingGenerationView({ markdown, isStreaming }: Props) {
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
    </div>
  );
}
