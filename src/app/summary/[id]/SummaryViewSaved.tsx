'use client';

import { useState } from 'react';
import Markdown from 'react-markdown';
import type { SavedSummary } from '@/lib/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeBubbles } from '@/components/ThemeBubbles';
import { copyRichText } from '@/lib/utils';

interface Props {
  summary: SavedSummary;
}

export function SummaryViewSaved({ summary }: Props) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await copyRichText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-6">
      {summary.themes.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Key themes (click to see quotes)
          </p>
          <ThemeBubbles themes={summary.themes} />
        </div>
      )}

      {summary.summaries.map((summaryText, index) => (
        <Card key={index}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {summary.summaries.length > 1 ? `Summary ${index + 1}` : 'Summary'}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(summaryText, index)}
              >
                {copiedIndex === index ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown>{summaryText}</Markdown>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="pt-4">
        <Card className="bg-muted/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Context used for this summary
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {/* Handle both new format (extractionGoal) and old format (whatMatters/why) */}
            {summary.context.extractionGoal ? (
              <p>
                <span className="font-medium">What to extract: </span>
                {summary.context.extractionGoal}
              </p>
            ) : (
              <>
                {'whatMatters' in summary.context && (
                  <p>
                    <span className="font-medium">What matters: </span>
                    {(summary.context as unknown as { whatMatters: string }).whatMatters}
                  </p>
                )}
                {'why' in summary.context && (
                  <p>
                    <span className="font-medium">Purpose: </span>
                    {(summary.context as unknown as { why: string }).why}
                  </p>
                )}
              </>
            )}
            {summary.context.additionalContext && (
              <p>
                <span className="font-medium">Additional context: </span>
                {summary.context.additionalContext}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
