'use client';

import { useState, useMemo } from 'react';
import type { Theme } from '@/lib/claude';
import { QuotesModal } from './QuotesModal';

const THEME_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
];

interface Props {
  themes: Theme[];
}

export function ThemeBubbles({ themes }: Props) {
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Assign a deterministic color to each theme based on its id
  const themeColors = useMemo(() => {
    const colors: Record<string, string> = {};
    themes.forEach((theme) => {
      // Simple hash of theme id to get consistent color index
      let hash = 0;
      for (let i = 0; i < theme.id.length; i++) {
        hash = (hash * 31 + theme.id.charCodeAt(i)) >>> 0;
      }
      colors[theme.id] = THEME_COLORS[hash % THEME_COLORS.length];
    });
    return colors;
  }, [themes]);

  const handleBubbleClick = (theme: Theme) => {
    setSelectedTheme(theme);
    setModalOpen(true);
  };

  if (themes.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 justify-center">
        {themes.map((theme) => {
          const color = themeColors[theme.id];
          return (
            <button
              key={theme.id}
              onClick={() => handleBubbleClick(theme)}
              className="px-4 py-2 rounded-full text-sm font-medium text-white transition-all duration-200 hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                backgroundColor: color,
                ['--tw-ring-color' as string]: color,
              }}
            >
              {theme.label}
            </button>
          );
        })}
      </div>
      <QuotesModal
        theme={selectedTheme}
        color={selectedTheme ? themeColors[selectedTheme.id] : THEME_COLORS[0]}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
