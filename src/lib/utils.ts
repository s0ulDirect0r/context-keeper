import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { marked } from "marked"
import type { StructuredSummary, SummaryContent } from '@/lib/summary-types'
import { isStructuredSummary } from '@/lib/summary-types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Copy text with both HTML (for rich paste) and plain text (fallback)
 */
export async function copyRichText(markdown: string): Promise<void> {
  const html = await marked(markdown);
  const plainText = markdown
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1');

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      }),
    ]);
  } catch {
    // Fallback for browsers that don't support ClipboardItem
    await navigator.clipboard.writeText(plainText);
  }
}

/**
 * Convert a StructuredSummary to readable markdown for copy-to-clipboard.
 */
export function structuredSummaryToMarkdown(summary: StructuredSummary): string {
  const lines: string[] = [];

  if (summary.title) {
    lines.push(`# ${summary.title}`);
    if (summary.date) lines.push(`*${summary.date}*`);
    lines.push('');
  }

  if (summary.keyMoments) {
    lines.push('## Key Moments');
    for (const m of summary.keyMoments.moments) {
      const ts = m.timestamp ? ` [${m.timestamp}]` : '';
      lines.push(`> "${m.text}" — *${m.speaker}*${ts}`);
      lines.push('');
    }
  }

  if (summary.questionsAndAnswers) {
    lines.push('## Questions & Answers');
    for (const qa of summary.questionsAndAnswers.items) {
      const asker = qa.questionSpeaker ? ` (${qa.questionSpeaker})` : '';
      lines.push(`**Q:** ${qa.question}${asker}`);
      if (qa.unanswered) {
        lines.push('*Unanswered*');
      } else if (qa.answer) {
        const answerer = qa.answerSpeaker ? ` — *${qa.answerSpeaker}*` : '';
        lines.push(`> ${qa.answer}${answerer}`);
      }
      lines.push('');
    }
  }

  if (summary.emergingThemes) {
    lines.push('## Emerging Themes');
    for (const theme of summary.emergingThemes.themes) {
      lines.push(`### ${theme.label}`);
      for (const b of theme.bullets) {
        lines.push(`- ${b}`);
      }
      lines.push('');
    }
  }

  if (summary.keyInsights) {
    lines.push('## Key Insights');
    for (const insight of summary.keyInsights.insights) {
      const ts = insight.timestamp ? ` [${insight.timestamp}]` : '';
      lines.push(`> "${insight.text}" — *${insight.speaker}*${ts}`);
      lines.push('');
    }
  }

  if (summary.momentum) {
    lines.push('## Momentum');
    for (const item of summary.momentum.items) {
      lines.push(`- ${item.text}`);
    }
    lines.push('');
  }

  if (summary.observersPerspective) {
    lines.push("## Observer's Perspective");
    lines.push(summary.observersPerspective.content);
    lines.push('');
  }

  return lines.join('\n').trim();
}

/**
 * Plain-text preview for dashboard cards.
 */
export function getSummaryPreviewText(summaries: SummaryContent): string {
  if (isStructuredSummary(summaries)) {
    const s = summaries[0];
    if (s.observersPerspective) return s.observersPerspective.content;
    if (s.keyMoments?.moments.length) return s.keyMoments.moments.map(m => m.text).join(' ');
    if (s.keyInsights?.insights.length) return s.keyInsights.insights.map(i => i.text).join(' ');
    if (s.emergingThemes?.themes.length) return s.emergingThemes.themes.map(t => t.label).join(', ');
    return s.title || '';
  }
  // Markdown string — strip markdown formatting and take first ~200 chars
  const raw = (summaries[0] || '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/>\s*/gm, '')
    .trim();
  return raw.slice(0, 200);
}

/**
 * Searchable plain-text for dashboard filtering.
 */
export function getSummarySearchText(summaries: SummaryContent): string {
  if (isStructuredSummary(summaries)) {
    const parts: string[] = [];
    for (const s of summaries) {
      if (s.title) parts.push(s.title);
      if (s.observersPerspective) parts.push(s.observersPerspective.content);
      if (s.keyMoments) parts.push(...s.keyMoments.moments.map(m => `${m.text} ${m.speaker}`));
      if (s.questionsAndAnswers) {
        for (const qa of s.questionsAndAnswers.items) {
          parts.push(qa.question);
          if (qa.answer) parts.push(qa.answer);
        }
      }
      if (s.emergingThemes) {
        for (const t of s.emergingThemes.themes) {
          parts.push(t.label);
          parts.push(...t.bullets);
        }
      }
      if (s.keyInsights) parts.push(...s.keyInsights.insights.map(i => `${i.text} ${i.speaker}`));
      if (s.momentum) parts.push(...s.momentum.items.map(i => i.text));
    }
    return parts.join(' ');
  }
  // Markdown strings — just join them
  return summaries.join(' ');
}
