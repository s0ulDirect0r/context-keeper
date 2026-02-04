'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  summaries: string[];
  onStartOver: () => void;
}

export function SummaryView({ summaries, onStartOver }: Props) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Your Summary</h2>
        <p className="text-muted-foreground mt-1">
          Copy and paste into WhatsApp, email, or anywhere else
        </p>
      </div>

      {summaries.map((summary, index) => (
        <Card key={index}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {summaries.length > 1 ? `Summary ${index + 1}` : 'Summary'}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(summary, index)}
              >
                {copiedIndex === index ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {summary}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-center pt-4">
        <Button variant="outline" onClick={onStartOver}>
          Create another summary
        </Button>
      </div>
    </div>
  );
}
