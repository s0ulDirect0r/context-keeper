'use client';

import Markdown from 'react-markdown';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  markdown: string;
  isStreaming: boolean;
}

export function StreamingGenerationView({ markdown, isStreaming }: Props) {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <Card>
        <CardContent className="pt-6">
          {markdown ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown>{markdown}</Markdown>
              {isStreaming && (
                <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Generating your summary...</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
