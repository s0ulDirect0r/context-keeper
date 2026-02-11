import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Users, Sparkles, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onTryFree: () => void;
  onSignUp: () => void;
  onSignIn: () => void;
}

function HeroSection({ onTryFree, onSignIn }: Pick<LandingPageProps, 'onTryFree' | 'onSignIn'>) {
  return (
    <section className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-3xl space-y-6">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight">
          Same meeting. Different summaries.{' '}
          <span className="text-primary">Each one tailored to who needs it.</span>
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
          Import any meeting transcript. Tell us who it&apos;s for. Get a summary that speaks their language.
        </p>
        <div className="pt-4 flex flex-col items-center gap-3">
          <Button size="lg" onClick={onTryFree} className="text-base px-8 h-12">
            Try it free
            <ArrowRight className="ml-1 size-4" />
          </Button>
          <button
            onClick={onSignIn}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          >
            Already have an account? Sign in
          </button>
        </div>
      </div>
    </section>
  );
}

function BeforeAfterSection() {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="text-center space-y-3">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            One conversation, two perspectives
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            The same transcript produces completely different summaries depending on who needs to read it.
          </p>
        </div>

        {/* Transcript snippet */}
        <Card className="max-w-3xl mx-auto border-dashed">
          <CardContent className="py-2">
            <p className="text-sm font-mono text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Sarah:</span> We need to push the API migration to next sprint. The auth service refactor is blocking it, and we&apos;re still waiting on the security review.
            </p>
          </CardContent>
        </Card>

        {/* Side-by-side summary cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-blue-100 dark:bg-blue-900/40 p-1.5">
                  <Users className="size-4 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  For your manager
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                The API migration is delayed to next sprint due to dependencies on the auth service refactor and a pending security review. No action needed from you — the team is tracking it.
              </p>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 p-1.5">
                  <Users className="size-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
                  For the team
                </span>
              </div>
              <div className="text-sm leading-relaxed space-y-1">
                <p className="font-semibold">Action items:</p>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                  <li>Auth service refactor must complete before API migration can proceed</li>
                  <li>Security review still pending — owner needed</li>
                  <li>API migration moved to next sprint</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
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
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">How it works</h2>
          <p className="text-muted-foreground text-lg">Three steps. One tailored summary.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={step.title} className="text-center space-y-4">
              <div className="mx-auto flex items-center justify-center">
                <div className="relative">
                  <div className="rounded-full bg-primary/10 p-4">
                    <step.icon className="size-6 text-primary" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex items-center justify-center size-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {i + 1}
                  </span>
                </div>
              </div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTAFooterSection({ onTryFree, onSignUp }: Pick<LandingPageProps, 'onTryFree' | 'onSignUp'>) {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">Ready to try it?</h2>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" onClick={onTryFree} className="text-base px-8 h-12">
            Try it free
          </Button>
          <Button size="lg" variant="outline" onClick={onSignUp}>
            Sign up
          </Button>
        </div>
      </div>
    </section>
  );
}

export function LandingPage({ onTryFree, onSignUp, onSignIn }: LandingPageProps) {
  return (
    <main>
      <HeroSection onTryFree={onTryFree} onSignIn={onSignIn} />
      <BeforeAfterSection />
      <HowItWorksSection />
      <CTAFooterSection onTryFree={onTryFree} onSignUp={onSignUp} />
    </main>
  );
}
