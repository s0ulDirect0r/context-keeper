'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { SummaryContext } from '@/lib/claude';

interface Props {
  onComplete: (context: SummaryContext) => void;
  onBack: () => void;
}

const STEPS = ['extraction', 'additional'] as const;
type Step = (typeof STEPS)[number];

export function ContextWizard({ onComplete, onBack }: Props) {
  const [step, setStep] = useState<Step>('extraction');
  const [extractionGoal, setExtractionGoal] = useState('');
  const [additional, setAdditional] = useState('');

  const stepIndex = STEPS.indexOf(step);

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
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {step === 'extraction' && 'What do you want to extract from this recording?'}
            {step === 'additional' && 'Any other relevant context?'}
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {stepIndex + 1} / {STEPS.length}
          </span>
        </div>
        <CardDescription>
          {step === 'extraction' && 'Tell us what you\'re looking for in this transcript'}
          {step === 'additional' && 'Optional: About what you want, how you want it, or who it\'s for'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'extraction' && (
          <Textarea
            value={extractionGoal}
            onChange={(e) => setExtractionGoal(e.target.value)}
            placeholder={`e.g., "Key decisions and action items", "Technical architecture discussions", "Feedback on my presentation"`}
            className="min-h-32"
          />
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
