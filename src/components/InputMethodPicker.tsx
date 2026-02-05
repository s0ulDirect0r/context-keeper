'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface Props {
  onSelect: (method: 'otter' | 'manual') => void;
  connectedOtterEmail?: string;
  onDisconnectOtter?: () => void;
}

export function InputMethodPicker({ onSelect, connectedOtterEmail, onDisconnectOtter }: Props) {
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
              <p className="text-sm text-muted-foreground">
                Select recordings from your connected Otter account.
              </p>
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
