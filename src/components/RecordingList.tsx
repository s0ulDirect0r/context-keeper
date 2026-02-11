'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { Recording } from '@/lib/otter';

interface Props {
  recordings: Recording[];
  onSelect: (recordingIds: string[]) => void;
  onBack: () => void;
  loading?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function RecordingList({ recordings, onSelect, onBack, loading }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleContinue = () => {
    onSelect(Array.from(selected));
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Select Recordings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {recordings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            {loading ? (
              <>
                <div className="relative mb-4">
                  <div className="h-8 w-8 rounded-full border-4 border-muted" />
                  <div className="absolute top-0 left-0 h-8 w-8 rounded-full border-4 border-t-primary animate-spin" />
                </div>
                <p className="text-muted-foreground">Loading recordings...</p>
              </>
            ) : (
              <p className="text-muted-foreground">No recordings found</p>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recordings.map((recording) => (
              <div
                key={recording.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selected.has(recording.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                }`}
                onClick={() => toggleSelection(recording.id)}
              >
                <input
                  type="checkbox"
                  checked={selected.has(recording.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelection(recording.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  <Label className="font-medium cursor-pointer">{recording.title}</Label>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(recording.createdAt)} · {formatDuration(recording.duration)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={handleContinue}
            disabled={selected.size === 0 || loading}
          >
            {loading
              ? 'Loading...'
              : `Continue with ${selected.size} recording${selected.size !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
