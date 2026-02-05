'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { Theme } from '@/lib/claude';

interface Props {
  theme: Theme | null;
  color: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuotesModal({ theme, color, open, onOpenChange }: Props) {
  if (!theme) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="inline-block px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: color }}
            >
              {theme.label}
            </span>
          </DialogTitle>
          <DialogDescription>
            Quotes from the meeting that embody this theme
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          {theme.quotes.map((quote, index) => (
            <blockquote
              key={index}
              className="border-l-4 pl-4 py-2 italic text-muted-foreground"
              style={{ borderColor: color }}
            >
              <p className="text-foreground">&ldquo;{quote.text}&rdquo;</p>
              {quote.speaker && (
                <footer className="mt-1 text-sm font-medium">
                  &mdash; {quote.speaker}
                </footer>
              )}
            </blockquote>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
