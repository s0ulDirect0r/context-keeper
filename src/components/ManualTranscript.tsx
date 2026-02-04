'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  onSubmit: (transcript: string) => void;
  onBack: () => void;
}

export function ManualTranscript({ onSubmit, onBack }: Props) {
  const [transcript, setTranscript] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transcript.trim()) {
      onSubmit(transcript.trim());
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Paste your transcript</CardTitle>
        <CardDescription>
          Copy and paste your meeting transcript, notes, or any text you want to summarize.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your transcript here..."
            className="min-h-64 font-mono text-sm"
          />

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button type="submit" className="flex-1" disabled={!transcript.trim()}>
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
