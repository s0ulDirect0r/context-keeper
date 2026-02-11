'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';

interface Props {
  onSelect: (method: 'otter' | 'manual') => void;
  connectedOtterEmail?: string;
  onDisconnectOtter?: () => void;
  /** null = still loading, number = ready count */
  prefetchedRecordingCount?: number | null;
}

export function InputMethodPicker({ onSelect, connectedOtterEmail, onDisconnectOtter, prefetchedRecordingCount }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Context Keeper</h1>
        <p className="text-muted-foreground mt-2">Generate AI summaries tailored to your audience</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {connectedOtterEmail ? (
          <Card
            className="cursor-pointer transition-colors hover:border-primary border-green-200 dark:border-green-800"
            onClick={() => onSelect('otter')}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <CardTitle>Your Otter.ai</CardTitle>
              </div>
              <CardDescription>{connectedOtterEmail}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {prefetchedRecordingCount != null ? (
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  {prefetchedRecordingCount} recording{prefetchedRecordingCount !== 1 ? 's' : ''} ready
                </p>
              ) : connectedOtterEmail && prefetchedRecordingCount === null ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading recordings...
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select recordings from your connected Otter account.
                </p>
              )}
              {onDisconnectOtter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDisconnectOtter();
                  }}
                >
                  Disconnect
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
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
        )}

        <Card
          className="cursor-pointer transition-colors hover:border-primary"
          onClick={() => onSelect('manual')}
        >
          <CardHeader>
            <CardTitle>Paste or upload transcript</CardTitle>
            <CardDescription>Upload .txt, .srt, .vtt or paste text directly</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Have a transcript from another source? Upload a file or paste it directly to generate a summary.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
