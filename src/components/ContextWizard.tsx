'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import type { SummaryContext } from '@/lib/claude';

interface Props {
  onComplete: (context: SummaryContext) => void;
  onBack: () => void;
}

type WhoOption = 'myself' | 'someone-else' | 'group';

const STEPS = ['who', 'whatMatters', 'why', 'additional'] as const;
type Step = (typeof STEPS)[number];

export function ContextWizard({ onComplete, onBack }: Props) {
  const [step, setStep] = useState<Step>('who');
  const [who, setWho] = useState<WhoOption>('myself');
  const [whatMatters, setWhatMatters] = useState('');
  const [why, setWhy] = useState('');
  const [additional, setAdditional] = useState('');

  const stepIndex = STEPS.indexOf(step);

  const getWhoLabel = () => {
    switch (who) {
      case 'myself':
        return 'you';
      case 'someone-else':
        return 'this person';
      case 'group':
        return 'this group';
    }
  };

  const handleNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex]);
    } else {
      onComplete({
        who,
        whatMatters,
        why,
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
      case 'who':
        return true;
      case 'whatMatters':
        return whatMatters.trim().length > 0;
      case 'why':
        return why.trim().length > 0;
      case 'additional':
        return true;
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {step === 'who' && 'Who is this summary for?'}
            {step === 'whatMatters' && `What matters to ${getWhoLabel()}?`}
            {step === 'why' && 'Why are you creating this summary?'}
            {step === 'additional' && 'Anything else relevant?'}
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {stepIndex + 1} / {STEPS.length}
          </span>
        </div>
        <CardDescription>
          {step === 'who' && 'Help us tailor the summary to the right audience'}
          {step === 'whatMatters' && 'What topics, concerns, or interests should we focus on?'}
          {step === 'why' && 'Understanding the purpose helps us create a better summary'}
          {step === 'additional' && 'Optional: Add any extra context that might be helpful'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'who' && (
          <RadioGroup value={who} onValueChange={(v) => setWho(v as WhoOption)}>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50">
              <RadioGroupItem value="myself" id="myself" />
              <Label htmlFor="myself" className="flex-1 cursor-pointer">
                Myself
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50">
              <RadioGroupItem value="someone-else" id="someone-else" />
              <Label htmlFor="someone-else" className="flex-1 cursor-pointer">
                Someone else
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50">
              <RadioGroupItem value="group" id="group" />
              <Label htmlFor="group" className="flex-1 cursor-pointer">
                A group of people
              </Label>
            </div>
          </RadioGroup>
        )}

        {step === 'whatMatters' && (
          <Textarea
            value={whatMatters}
            onChange={(e) => setWhatMatters(e.target.value)}
            placeholder={`e.g., "Project deadlines and action items", "Technical decisions that affect my team", "Budget discussions and approvals"`}
            className="min-h-32"
          />
        )}

        {step === 'why' && (
          <Textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder={`e.g., "To brief my manager on what they missed", "To create meeting notes for the team", "To prepare for a follow-up discussion"`}
            className="min-h-32"
          />
        )}

        {step === 'additional' && (
          <Textarea
            value={additional}
            onChange={(e) => setAdditional(e.target.value)}
            placeholder="Any additional context that might help create a better summary..."
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
                    who,
                    whatMatters,
                    why,
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
