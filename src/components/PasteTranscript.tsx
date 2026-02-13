'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  onSubmit: (transcript: string) => void;
  onBack: () => void;
}

export function PasteTranscript({ onSubmit, onBack }: Props) {
  const [transcript, setTranscript] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transcript.trim()) {
      onSubmit(transcript.trim());
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Paste your transcript</h2>
        <p className="text-muted-foreground">Drop it in below and I&apos;ll take it from there.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste your meeting transcript or notes here..."
          className="min-h-72 font-mono text-sm"
          autoFocus
        />

        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button type="submit" className="flex-1" disabled={!transcript.trim()}>
            Looks good
          </Button>
        </div>
      </form>
    </div>
  );
}
