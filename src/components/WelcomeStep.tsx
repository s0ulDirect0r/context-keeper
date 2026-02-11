'use client';

import { Card, CardContent } from '@/components/ui/card';
import { FileText, Users, Sparkles, Play, Upload } from 'lucide-react';

interface WelcomeStepProps {
  onTryExample: () => void;
  onUseOwn: () => void;
}

const steps = [
  {
    icon: FileText,
    label: 'Import',
    description: 'Paste or upload your transcript',
  },
  {
    icon: Users,
    label: 'Focus',
    description: 'Tell us who it\'s for',
  },
  {
    icon: Sparkles,
    label: 'Get',
    description: 'A tailored summary',
  },
] as const;

export default function WelcomeStep({ onTryExample, onUseOwn }: WelcomeStepProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Welcome to Context Keeper
        </h1>
        <p className="text-base text-muted-foreground">
          Turn any meeting transcript into a summary tailored to your audience.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {steps.map((step, i) => (
          <div key={step.label} className="text-center space-y-2">
            <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
              <step.icon className="size-5 text-primary" />
            </div>
            <p className="text-sm font-semibold">
              <span className="text-muted-foreground mr-1">{i + 1}.</span>
              {step.label}
            </p>
            <p className="text-xs text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card
          className="cursor-pointer transition-colors hover:border-primary/50"
          onClick={onTryExample}
        >
          <CardContent className="space-y-2">
            <div className="rounded-full bg-primary/10 p-2 w-fit">
              <Play className="size-4 text-primary" />
            </div>
            <p className="font-semibold">Try with an example</p>
            <p className="text-sm text-muted-foreground">
              See how it works with a sample meeting transcript
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer transition-colors hover:border-primary/50"
          onClick={onUseOwn}
        >
          <CardContent className="space-y-2">
            <div className="rounded-full bg-primary/10 p-2 w-fit">
              <Upload className="size-4 text-primary" />
            </div>
            <p className="font-semibold">Use my own transcript</p>
            <p className="text-sm text-muted-foreground">
              Paste, upload, or import from Otter.ai
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
