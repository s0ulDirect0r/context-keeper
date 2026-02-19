'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';

interface Props {
  onSelect: (method: 'otter' | 'manual' | 'paste') => void;
  connectedOtterEmail?: string;
  onDisconnectOtter?: () => void;
  /** null = still loading, number = ready count */
  prefetchedRecordingCount?: number | null;
}

export function InputMethodPicker({
  onSelect,
  connectedOtterEmail,
  onDisconnectOtter,
  prefetchedRecordingCount,
}: Props) {
  return (
    <div className="flex flex-col items-center px-8 pt-[12vh] pb-12 space-y-10">
      <div className="text-center space-y-3">
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">Cedar</h1>
        <p className="text-lg text-muted-foreground">Choose what you want me to work with</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3 w-full max-w-5xl">
        {connectedOtterEmail ? (
          <Card
            className="cursor-pointer transition-colors hover:border-primary border-green-200 dark:border-green-800 p-6"
            onClick={() => onSelect('otter')}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <Check className="h-6 w-6 text-green-600" />
                <CardTitle className="text-xl">Your Otter.ai</CardTitle>
              </div>
              <CardDescription className="text-base">{connectedOtterEmail}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {prefetchedRecordingCount != null ? (
                <p className="text-base text-green-600 dark:text-green-400 flex items-center gap-2">
                  <Check className="h-5 w-5" />
                  {prefetchedRecordingCount} recording{prefetchedRecordingCount !== 1 ? 's' : ''}{' '}
                  ready
                </p>
              ) : connectedOtterEmail && prefetchedRecordingCount === null ? (
                <p className="text-base text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading recordings...
                </p>
              ) : (
                <p className="text-base text-muted-foreground">
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
            className="cursor-pointer transition-colors hover:border-primary p-6"
            onClick={() => onSelect('otter')}
          >
            <CardHeader>
              <CardTitle className="text-xl">Connect to Otter.ai</CardTitle>
              <CardDescription className="text-base">
                Import transcripts from your Otter recordings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-base text-muted-foreground">
                Sign in with your Otter.ai account to select recordings and automatically import
                transcripts.
              </p>
            </CardContent>
          </Card>
        )}

        <Card
          className="cursor-pointer transition-colors hover:border-primary p-6"
          onClick={() => onSelect('manual')}
        >
          <CardHeader>
            <CardTitle className="text-xl">Upload files</CardTitle>
            <CardDescription className="text-base">
              Upload .txt, .srt, or .vtt files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-base text-muted-foreground">
              Have a transcript file from another source? Upload it to generate a summary.
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-colors hover:border-primary p-6"
          onClick={() => onSelect('paste')}
        >
          <CardHeader>
            <CardTitle className="text-xl">Paste text</CardTitle>
            <CardDescription className="text-base">Paste a transcript directly</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-base text-muted-foreground">
              Copy and paste meeting notes or transcript text to generate a summary.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
