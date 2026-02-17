'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import type { SummaryContext, SummaryStyle } from '@/lib/claude';

interface Props {
  onComplete: (context: SummaryContext) => void;
  onBack: () => void;
  recordingCount?: number;
}

const TEMPLATES = [
  {
    id: 'catch-up',
    label: 'Catch me up',
    description: 'What happened and what do I need to know',
    extractionGoal:
      'Key context, decisions, and anything the recipient would need to understand the current state',
    step2Hint:
      'Who\u2019s this for and what do they already know? e.g., "My manager missed standup" or "My housemate needs the renovation update."',
  },
  {
    id: 'align',
    label: 'Get everyone aligned',
    description: 'Same page, shared next steps',
    extractionGoal: 'What was agreed, who owns what, and the shared understanding of next steps',
    step2Hint:
      'Who needs alignment and on what? e.g., "The whole team needs to know what changed" or "My friends need the plan for the trip."',
  },
  {
    id: 'read-room',
    label: 'Help me read the room',
    description: 'Give me the warm data, the vibe, and the relational dynamics',
    extractionGoal:
      'The implicit dynamics present that might not be obvious to participants of the meeting',
    step2Hint:
      'What is the current mood, energy, and vibe of the meeting? e.g., "The team is excited about the new project" or "My partner is frustrated with the contractor."',
  },
  {
    id: 'remember',
    label: 'Help me remember',
    description: 'I want to reconnect with what happened',
    extractionGoal:
      'Comprehensive notes with important quotes, nuances, and details I might forget. Turning points. Insights. Any decisions that were made.',
    step2Hint:
      'What key moments or decisions were made during the meeting? e.g., "We agreed to meet again next week" or "I promised to send an email with the details."',
  },
] as const;

const GENERIC_HINT =
  'Who\u2019s this for and what do they need to understand? The more I know about the gap between what you know and what they know, the better.';

const STEPS = ['extraction', 'additional'] as const;
type Step = (typeof STEPS)[number];

export function ContextWizard({ onComplete, onBack, recordingCount = 1 }: Props) {
  const [step, setStep] = useState<Step>('extraction');
  const [extractionGoal, setExtractionGoal] = useState('');
  const [additional, setAdditional] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>('standard');
  const [includeCedarView, setIncludeCedarView] = useState(false);

  const stepIndex = STEPS.indexOf(step);

  const handleTemplateClick = (templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    if (selectedTemplate === templateId) {
      setSelectedTemplate(null);
      setExtractionGoal('');
    } else {
      setSelectedTemplate(templateId);
      setExtractionGoal(template.extractionGoal);
    }
  };

  const handleExtractionChange = (value: string) => {
    setExtractionGoal(value);
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
        summaryStyle,
        includeCedarView: summaryStyle === 'structured' ? includeCedarView : undefined,
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
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {step === 'extraction' && `What would you like help with here`}
          {step === 'extraction' && '?'}
          {step === 'additional' && 'Anything else I should know?'}
        </h2>
        <p className="text-muted-foreground">
          {step === 'extraction' && 'Pick a template or tell me in your own words.'}
          {step === 'additional' &&
            'Optional \u2014 any context about the audience, the meeting, or what you need this for.'}
        </p>
      </div>

      <div className="space-y-4">
        {step === 'extraction' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  aria-pressed={selectedTemplate === template.id}
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

            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium text-muted-foreground">Summary style</p>
              <RadioGroup
                value={summaryStyle}
                onValueChange={(v) => setSummaryStyle(v as SummaryStyle)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="standard" id="style-standard" />
                  <Label htmlFor="style-standard" className="cursor-pointer text-sm">
                    Standard
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="structured" id="style-structured" />
                  <Label htmlFor="style-structured" className="cursor-pointer text-sm">
                    Structured
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                {summaryStyle === 'standard'
                  ? 'Flexible format that adapts to the meeting type.'
                  : 'Quote-driven format with central questions and status labels.'}
              </p>
              {summaryStyle === 'structured' && (
                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCedarView}
                    onChange={(e) => setIncludeCedarView(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-muted-foreground">
                    Include Cedar&apos;s read on the room
                  </span>
                </label>
              )}
            </div>

            <Textarea
              value={extractionGoal}
              onChange={(e) => handleExtractionChange(e.target.value)}
              placeholder='Or describe it yourself e.g., "Catch my cofounder up on the investor call", "Help me remember the details for my proposal"'
              className="min-h-32"
            />
          </>
        )}

        {step === 'additional' && (
          <Textarea
            value={additional}
            onChange={(e) => setAdditional(e.target.value)}
            className="min-h-32"
          />
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={handleBack}>
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
                    summaryStyle,
                    includeCedarView: summaryStyle === 'structured' ? includeCedarView : undefined,
                  })
                }
              >
                That&apos;s all
              </Button>
              <Button className="flex-1" onClick={handleNext}>
                Add this context
              </Button>
            </>
          ) : (
            <Button className="flex-1" onClick={handleNext} disabled={!canProceed()}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
