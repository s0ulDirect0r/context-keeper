'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { SummaryContext } from '@/lib/claude';

interface Props {
  onComplete: (context: SummaryContext) => void;
  onBack: () => void;
  recordingCount?: number;
}

const TEMPLATES = [
  {
    id: 'manager',
    label: 'For my manager',
    description: 'Decisions, blockers, and status updates',
    extractionGoal: 'Key decisions, blockers raised, and status updates',
    step2Hint: 'Tip: Mention what your manager tracks — e.g., "She\'s focused on the Q2 deadline" or "He wasn\'t in last week\'s standup." This shapes the summary to what they actually need.',
  },
  {
    id: 'team',
    label: 'For the team',
    description: 'Action items, owners, and next steps',
    extractionGoal: 'Action items with owners, decisions made, and next steps',
    step2Hint: 'Tip: Mention who needs to know what — e.g., "Backend team needs the API changes" or "Design wasn\'t represented." This ensures the right details reach the right people.',
  },
  {
    id: 'stakeholder',
    label: 'For a stakeholder',
    description: 'High-level outcomes, no jargon',
    extractionGoal: 'High-level outcomes, key decisions, and strategic implications',
    step2Hint: 'Tip: Add their context — e.g., "She\'s evaluating whether to fund phase 2" or "He cares about customer impact, not technical details."',
  },
  {
    id: 'self',
    label: 'For myself',
    description: 'Deep notes with verbatim quotes',
    extractionGoal: 'Comprehensive notes with important quotes, nuances, and details I might forget',
    step2Hint: 'Tip: Flag what matters to you — e.g., "I need to prep a proposal from this" or "Track what Alice said about the timeline." Your future self will thank you.',
  },
] as const;

const GENERIC_HINT = 'Tip: Tell us who this is for and what they care about. The more context, the better the summary.';

const STEPS = ['extraction', 'additional'] as const;
type Step = (typeof STEPS)[number];

export function ContextWizard({ onComplete, onBack, recordingCount = 1 }: Props) {
  const [step, setStep] = useState<Step>('extraction');
  const [extractionGoal, setExtractionGoal] = useState('');
  const [additional, setAdditional] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(step);

  const handleTemplateClick = (templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    if (selectedTemplate === templateId) {
      // Deselect on second click
      setSelectedTemplate(null);
      setExtractionGoal('');
    } else {
      setSelectedTemplate(templateId);
      setExtractionGoal(template.extractionGoal);
    }
  };

  const handleExtractionChange = (value: string) => {
    setExtractionGoal(value);
    // Clear template selection when user types custom text
    if (selectedTemplate) {
      const template = TEMPLATES.find((t) => t.id === selectedTemplate);
      if (template && value !== template.extractionGoal) {
        setSelectedTemplate(null);
      }
    }
  };

  const activeTemplate = TEMPLATES.find((t) => t.id === selectedTemplate);

  const handleNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex]);
    } else {
      onComplete({
        extractionGoal,
        additionalContext: additional || undefined,
      });
    }
  };

  const handleBack = () => {
    if (stepIndex === 0) {
      onBack();
    } else {
      setStep(STEPS[stepIndex - 1]);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 'extraction':
        return extractionGoal.trim().length > 0;
      case 'additional':
        return true;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {step === 'extraction' && `What do you want to extract from ${recordingCount > 1 ? 'these recordings' : 'this recording'}?`}
            {step === 'additional' && 'Any other relevant context?'}
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {stepIndex + 1} / {STEPS.length}
          </span>
        </div>
        <CardDescription>
          {step === 'extraction' && 'Pick a template or write your own'}
          {step === 'additional' && 'Optional: About what you want, how you want it, or who it\'s for'}
        </CardDescription>
        {step === 'additional' && (
          <p className="text-sm text-muted-foreground italic bg-muted/50 rounded-md p-3 mt-1">
            {activeTemplate ? activeTemplate.step2Hint : GENERIC_HINT}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'extraction' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateClick(template.id)}
                  className={`rounded-lg border p-3 text-left transition-colors hover:bg-accent/50 ${
                    selectedTemplate === template.id
                      ? 'ring-2 ring-primary border-primary bg-accent/30'
                      : 'border-border'
                  }`}
                >
                  <div className="font-medium text-sm">{template.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{template.description}</div>
                </button>
              ))}
            </div>

            <Textarea
              value={extractionGoal}
              onChange={(e) => handleExtractionChange(e.target.value)}
              placeholder={`e.g., "Key decisions and action items", "Technical architecture discussions", "Feedback on my presentation"`}
              className="min-h-32"
            />
          </>
        )}

        {step === 'additional' && (
          <Textarea
            value={additional}
            onChange={(e) => setAdditional(e.target.value)}
            placeholder={`e.g., "This is for my manager who wasn't in the meeting", "Focus on the budget discussion", "I need bullet points I can share with the team"`}
            className="min-h-32"
          />
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={handleBack}>
            Back
          </Button>
          {step === 'additional' ? (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  onComplete({
                    extractionGoal,
                    additionalContext: undefined,
                  })
                }
              >
                Skip
              </Button>
              <Button className="flex-1" onClick={handleNext}>
                Continue
              </Button>
            </>
          ) : (
            <Button className="flex-1" onClick={handleNext} disabled={!canProceed()}>
              Continue
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
