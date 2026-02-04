'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  onSelect: (method: 'otter' | 'manual') => void;
}

export function InputMethodPicker({ onSelect }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Context Keeper</h1>
        <p className="text-muted-foreground mt-2">Generate AI summaries tailored to your audience</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="cursor-pointer transition-colors hover:border-primary"
          onClick={() => onSelect('otter')}
        >
          <CardHeader>
            <CardTitle>Connect to Otter.ai</CardTitle>
            <CardDescription>Import transcripts from your Otter recordings</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sign in with your Otter.ai account to select recordings and automatically import
              transcripts.
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-colors hover:border-primary"
          onClick={() => onSelect('manual')}
        >
          <CardHeader>
            <CardTitle>Paste transcript manually</CardTitle>
            <CardDescription>Copy and paste your transcript text</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Have a transcript from another source? Paste it directly to generate a summary.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
