'use client';

import { Button } from '@/components/ui/button';

interface SpeakerSelectProps {
  speakerNames: string[];
  onSelect: (name: string | null) => void;
  onBack: () => void;
}

export function SpeakerSelect({ speakerNames, onSelect, onBack }: SpeakerSelectProps) {
  return (
    <div className="max-w-md mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          Quick question — which one is you?
        </h2>
        <p className="text-muted-foreground">
          I found these speakers in the transcript. Knowing which one is you helps me write better
          pearls.
        </p>
      </div>

      <div className="space-y-2">
        {speakerNames.map((name) => (
          <Button
            key={name}
            variant="outline"
            className="w-full justify-start text-left text-base py-3"
            onClick={() => onSelect(name)}
          >
            {name}
          </Button>
        ))}
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => onSelect(null)}
        >
          None of these
        </Button>
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
