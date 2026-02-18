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
    description: 'Paste a transcript or connect with your Otter.ai',
  },
  {
    icon: Users,
    title: 'Add context',
    description: 'Tell Cedar what you want to get from the meeting and why',
  },
  {
    icon: Sparkles,
    title: 'Get a summary',
    description: 'Shaped in the way that is most useful to you and share-able with others',
  },
] as const;

function SalesPitchSection() {
  return (
    <section className="py-16 px-8 sm:px-4 text-center">
      <div className="max-w-xl mx-auto space-y-8 text-base text-foreground/80">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Memory has limits. Meaning doesn&apos;t.
        </h2>

        <div className="space-y-1">
          <p>You&apos;re the connective tissue.</p>
          <p>You don&apos;t just attend meetings — you track the room.</p>
          <p>Who needs to know what, what it meant, what happens next.</p>
          <p>You&apos;re managing the context gap — with limited memory and a busy schedule.</p>
          <p className="font-bold">Cedar is built for that gap.</p>
          <p>
            An external memory that thinks like you, so meaning doesn&apos;t live only in your
            imperfect recollection of it.
          </p>
        </div>
      </div>
    </section>
  );
}

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
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Cedar</h1>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-snug">
            Turn your meeting recordings into clear, useful insights
          </h2>
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
      <SalesPitchSection />
      <HowItWorksSection />
    </main>
  );
}
