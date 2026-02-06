'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Speaker } from '@/lib/claude';

interface Props {
  speakers: Speaker[];
}

export function SpeakerToolbar({ speakers }: Props) {
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  if (speakers.length === 0) return null;

  const handleClick = (speaker: Speaker) => {
    setSelectedSpeaker(speaker);
    setModalOpen(true);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 justify-center">
        {speakers.map((speaker) => (
          <button
            key={speaker.id}
            onClick={() => handleClick(speaker)}
            className="px-3 py-1.5 rounded-full text-sm font-medium border border-border bg-background text-foreground transition-all duration-200 hover:bg-muted hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {speaker.name}
          </button>
        ))}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {selectedSpeaker && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedSpeaker.name}</DialogTitle>
                <DialogDescription>Key quotes from this speaker</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                {selectedSpeaker.quotes.map((quote, index) => (
                  <blockquote
                    key={index}
                    className="border-l-4 border-muted-foreground/30 pl-4 py-2 italic text-muted-foreground"
                  >
                    <p className="text-foreground">&ldquo;{quote.text}&rdquo;</p>
                  </blockquote>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
