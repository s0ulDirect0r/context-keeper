'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
    <div className="w-full max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          You picked {recordingCount} recordings
        </h2>
        <p className="text-muted-foreground">
          Should I combine them into one summary, or keep them separate?
        </p>
      </div>

      <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'combined' | 'separate')}>
        <div className="flex items-start space-x-2 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer">
          <RadioGroupItem value="combined" id="combined" className="mt-1" />
          <div className="flex-1">
            <Label htmlFor="combined" className="cursor-pointer font-medium">
              One combined summary
            </Label>
            <p className="text-sm text-muted-foreground">
              I&apos;ll weave everything together into a single document.
            </p>
          </div>
        </div>
        <div className="flex items-start space-x-2 p-4 rounded-lg border hover:bg-muted/50 cursor-pointer">
          <RadioGroupItem value="separate" id="separate" className="mt-1" />
          <div className="flex-1">
            <Label htmlFor="separate" className="cursor-pointer font-medium">
              Separate summaries
            </Label>
            <p className="text-sm text-muted-foreground">
              I&apos;ll give each recording its own summary.
            </p>
          </div>
        </div>
      </RadioGroup>

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-1" onClick={() => onSelect(mode)}>
          Let&apos;s go
        </Button>
      </div>
    </div>
  );
}
