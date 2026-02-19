'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import type { SummaryContext } from '@/models/types';

interface Props {
  onComplete: (context: SummaryContext) => void;
  onBack: () => void;
}

const TEMPLATES = [
  {
    id: 'catch-up',
    label: 'Catch me up',
    description: 'What happened and what matters most',
    extractionGoal:
      'Key context, decisions, and anything the recipient would need to understand the current state',
  },
  {
    id: 'align',
    label: 'Summarise for others',
    description: 'Shared context and clear next steps',
    extractionGoal: 'What was agreed, who owns what, and the shared understanding of next steps',
  },
  {
    id: 'read-room',
    label: 'Help me read the room',
    description: 'The dynamics, tensions, and unspoken signals',
    extractionGoal:
      'The implicit dynamics present that might not be obvious to participants of the meeting',
  },
  {
    id: 'remember',
    label: 'Help me remember',
    description: 'Key moments, insights and quotes',
    extractionGoal:
      'Comprehensive notes with important quotes, nuances, and details I might forget. Turning points. Insights. Any decisions that were made.',
  },
] as const;

const SUMMARY_STYLES = ['standard', 'structured', 'custom'] as const;
type SummaryStyle = (typeof SUMMARY_STYLES)[number];

function isSummaryStyle(value: string): value is SummaryStyle {
  return (SUMMARY_STYLES as readonly string[]).includes(value);
}

const FORMAT_OPTIONS = [
  { value: 'standard', label: 'Standard', description: 'Adapts to the themes' },
  { value: 'structured', label: 'Structured', description: 'Pull out central questions' },
  { value: 'custom', label: 'Custom', description: 'Describe the format you want' },
] as const;

const STEPS = ['extraction', 'format', 'additional'] as const;
type Step = (typeof STEPS)[number];

export function ContextWizard({ onComplete, onBack }: Props) {
  const [step, setStep] = useState<Step>('extraction');
  const [extractionGoal, setExtractionGoal] = useState('');
  const [additional, setAdditional] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>('standard');
  const [customFormatDescription, setCustomFormatDescription] = useState('');

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

  const handleNext = () => {
    const nextIndex = stepIndex + 1;
    if (nextIndex < STEPS.length) {
      setStep(STEPS[nextIndex]);
    } else {
      onComplete({
        extractionGoal,
        additionalContext: additional || undefined,
        summaryStyle,
        customFormatDescription: summaryStyle === 'custom' ? customFormatDescription : undefined,
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
      case 'format':
        if (summaryStyle === 'custom') return customFormatDescription.trim().length > 0;
        return true;
      case 'additional':
        return true;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {step === 'extraction' && 'What can I help you with?'}
          {step === 'format' && 'Choose a summary format.'}
          {step === 'additional' && 'Anything else I should know?'}
        </h2>
        <p className="text-muted-foreground">
          {step === 'extraction' && 'Pick a template to get started.'}
          {step === 'format' && 'Not sure? Start with Standard.'}
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
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors hover:bg-accent/50',
                    selectedTemplate === template.id
                      ? 'ring-2 ring-primary border-primary bg-accent/30'
                      : 'border-border',
                  )}
                >
                  <div className="font-medium text-sm">{template.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{template.description}</div>
                </button>
              ))}
            </div>

            <p className="text-muted-foreground text-center">or, tell me in your own words</p>

            <Textarea
              value={extractionGoal}
              onChange={(e) => handleExtractionChange(e.target.value)}
              placeholder='e.g., "Catch my developer up on the user feedback call"'
              className="min-h-32"
            />
          </>
        )}

        {step === 'format' && (
          <>
            <RadioGroup
              value={summaryStyle}
              onValueChange={(v) => {
                if (isSummaryStyle(v)) setSummaryStyle(v);
              }}
              className="flex gap-3"
            >
              {FORMAT_OPTIONS.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`style-${option.value}`}
                  className={cn(
                    'flex-1 flex items-start space-x-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/50',
                    summaryStyle === option.value
                      ? 'ring-2 ring-primary border-primary bg-accent/30'
                      : 'border-border',
                  )}
                >
                  <RadioGroupItem
                    value={option.value}
                    id={`style-${option.value}`}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-sm">{option.label}</span>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
            {summaryStyle === 'custom' && (
              <Textarea
                value={customFormatDescription}
                onChange={(e) => setCustomFormatDescription(e.target.value)}
                placeholder='e.g. "Bullet points grouped by speaker", "Email draft for my manager", "Action items only as a checklist"'
                className="min-h-32"
              />
            )}
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
                    customFormatDescription:
                      summaryStyle === 'custom' ? customFormatDescription : undefined,
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
