'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { copyRichText, structuredSummaryToMarkdown } from '@/lib/utils';
import type { StructuredSummary } from '@/lib/summary-types';

interface Props {
  summary: StructuredSummary;
  index?: number;
  total?: number;
}

function QuoteBlock({ text, speaker, timestamp }: { text: string; speaker: string; timestamp?: string }) {
  return (
    <blockquote className="border-l-2 border-current/20 pl-3 my-2">
      <p className="italic text-sm">&ldquo;{text}&rdquo;</p>
      <p className="text-xs text-muted-foreground mt-1">
        &mdash; {speaker}
        {timestamp && (
          <span className="ml-2 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">
            {timestamp}
          </span>
        )}
      </p>
    </blockquote>
  );
}

export function StructuredSummaryView({ summary, index, total }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const markdown = structuredSummaryToMarkdown(summary);
      await copyRichText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const showHeader = (total ?? 1) > 1;
  const headerLabel = showHeader ? `Summary ${(index ?? 0) + 1}` : 'Summary';

  return (
    <div className="space-y-4">
      {/* Top-level copy button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{headerLabel}</h3>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      {/* Key Moments */}
      {summary.keyMoments && summary.keyMoments.moments.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Key Moments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {summary.keyMoments.moments.map((moment, i) => (
              <QuoteBlock key={i} text={moment.text} speaker={moment.speaker} timestamp={moment.timestamp} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Questions & Answers */}
      {summary.questionsAndAnswers && summary.questionsAndAnswers.items.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-300">
              Questions &amp; Answers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.questionsAndAnswers.items.map((qa, i) => (
              <div key={i}>
                <p className="text-sm font-medium">
                  Q: {qa.question}
                  {qa.questionSpeaker && (
                    <span className="text-xs text-muted-foreground ml-1">({qa.questionSpeaker})</span>
                  )}
                </p>
                {qa.unanswered ? (
                  <p className="text-xs text-muted-foreground italic mt-1">Unanswered</p>
                ) : qa.answer ? (
                  <blockquote className="border-l-2 border-blue-300 dark:border-blue-700 pl-3 mt-1">
                    <p className="text-sm">{qa.answer}</p>
                    {qa.answerSpeaker && (
                      <p className="text-xs text-muted-foreground mt-0.5">&mdash; {qa.answerSpeaker}</p>
                    )}
                  </blockquote>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Emerging Themes */}
      {summary.emergingThemes && summary.emergingThemes.themes.length > 0 && (
        <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-800 dark:text-purple-300">
              Emerging Themes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.emergingThemes.themes.map((theme, i) => (
              <div key={i}>
                <p className="text-sm font-semibold">{theme.label}</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground mt-1 space-y-0.5">
                  {theme.bullets.map((bullet, j) => (
                    <li key={j}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Key Insights */}
      {summary.keyInsights && summary.keyInsights.insights.length > 0 && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-800 dark:text-green-300">
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {summary.keyInsights.insights.map((insight, i) => (
              <QuoteBlock key={i} text={insight.text} speaker={insight.speaker} timestamp={insight.timestamp} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Momentum */}
      {summary.momentum && summary.momentum.items.length > 0 && (
        <Card className="border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Momentum
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside text-sm space-y-1">
              {summary.momentum.items.map((item, i) => (
                <li key={i}>{item.text}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Observer's Perspective */}
      {summary.observersPerspective && (
        <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
              Observer&apos;s Perspective
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm italic">{summary.observersPerspective.content}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
