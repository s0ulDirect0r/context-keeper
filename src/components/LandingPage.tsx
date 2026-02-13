import { Button } from '@/components/ui/button';
import { FileText, Users, Sparkles, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onTryFree: () => void;
  onSignUp: () => void;
  onSignIn: () => void;
}

const steps = [
  {
    icon: FileText,
    title: 'Import',
    description: 'Paste a transcript or connect Otter.ai',
  },
  {
    icon: Users,
    title: 'Tell us who it\u2019s for',
    description: 'Pick a template or describe your audience',
  },
  {
    icon: Sparkles,
    title: 'Get your summary',
    description: 'Tailored to exactly what they need',
  },
] as const;

function HowItWorksSection() {
  return (
    <section className="py-12 px-4 bg-muted/30">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
          <p className="text-sm text-muted-foreground">Three steps. One tailored summary.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div key={step.title} className="text-center space-y-2">
              <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit">
                <step.icon className="size-5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">{step.title}</h3>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingPage({ onTryFree, onSignUp, onSignIn }: LandingPageProps) {
  return (
    <main>
      <section className="pt-16 pb-8 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-4xl sm:text-5xl font-bold tracking-tight">Cedar</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-snug">
            Turn your meeting recordings into clear, useful insights
          </h1>
          <div className="pt-2 flex flex-col items-center gap-3">
            <div className="flex gap-3">
              <Button size="lg" onClick={onTryFree}>
                Try it free
                <ArrowRight className="ml-1 size-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={onSignUp}>
                Sign up
              </Button>
            </div>
            <button
              onClick={onSignIn}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </section>
      <HowItWorksSection />
    </main>
  );
}
