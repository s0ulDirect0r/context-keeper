'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SpeakerSelectProps {
  speakerNames: string[];
  onSelect: (name: string | null) => void;
  onBack: () => void;
}

export function SpeakerSelect({ speakerNames, onSelect, onBack }: SpeakerSelectProps) {
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Which speaker are you?</h2>
        <p className="text-muted-foreground mt-2">
          This helps us distinguish your quotes from your team&apos;s in the pearls.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Speakers found in transcript</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {speakerNames.map((name) => (
            <Button
              key={name}
              variant="outline"
              className="w-full justify-start text-left"
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
            None of these / Skip
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
