'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface Props {
  recordingCount: number;
  onSelect: (mode: 'combined' | 'separate') => void;
  onBack: () => void;
}

export function SummaryModeSelector({ recordingCount, onSelect, onBack }: Props) {
  const [mode, setMode] = useState<'combined' | 'separate'>('combined');

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>How should we summarize?</CardTitle>
        <CardDescription>
          You selected {recordingCount} recordings. Choose how to generate summaries.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'combined' | 'separate')}>
          <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-muted/50">
            <RadioGroupItem value="combined" id="combined" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="combined" className="cursor-pointer font-medium">
                One combined summary
              </Label>
              <p className="text-sm text-muted-foreground">
                Merge all recordings into a single comprehensive summary
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-2 p-3 rounded-lg border hover:bg-muted/50">
            <RadioGroupItem value="separate" id="separate" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="separate" className="cursor-pointer font-medium">
                Separate summaries
              </Label>
              <p className="text-sm text-muted-foreground">
                Generate individual summaries for each recording
              </p>
            </div>
          </div>
        </RadioGroup>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button className="flex-1" onClick={() => onSelect(mode)}>
            Generate Summary
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
