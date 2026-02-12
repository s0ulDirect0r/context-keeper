import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Users, Sparkles, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onTryFree: () => void;
  onSignUp: () => void;
  onSignIn: () => void;
}

function HeroSection({
  onTryFree,
  onSignUp,
  onSignIn,
}: Pick<LandingPageProps, 'onTryFree' | 'onSignUp' | 'onSignIn'>) {
  return (
    <section className="pt-16 pb-8 px-4 text-center">
      <div className="max-w-2xl mx-auto space-y-4">
        <p className="text-4xl sm:text-5xl font-bold tracking-tight">Context Keeper</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-snug">
          Same meeting. Different summaries. Each one tailored to who needs it.
        </h1>
        <p className="text-base text-muted-foreground max-w-lg mx-auto">
          Import any meeting transcript. Tell us who it&apos;s for. Get a summary that speaks their
          language.
        </p>
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
  );
}

function BeforeAfterSection() {
  return (
    <section className="py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">One conversation, two perspectives</h2>
          <p className="text-sm text-muted-foreground">
            The same transcript produces completely different summaries depending on who reads it.
          </p>
        </div>

        {/* Transcript snippet — multi-speaker dialogue */}
        <div className="max-w-3xl mx-auto rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-5 py-4 space-y-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70 mb-3">
            From the transcript
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Sarah:</span> We need to push the API
            migration to next sprint. The auth service refactor is blocking it, and we&apos;re still
            waiting on the security review from compliance.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">James:</span> I can have the auth
            refactor done by Thursday, but the compliance review is out of our hands. I&apos;ve
            pinged them twice.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Sarah:</span> OK, let&apos;s flag it as
            a blocker in the sprint retro. If we don&apos;t hear back by Friday, I&apos;ll escalate
            to VP Eng.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Marcus:</span> Should we start scoping
            the fallback plan in case the migration slips further? We promised the client a demo in
            three weeks.
          </p>
        </div>

        {/* Arrow / flow indicator */}
        <div className="flex justify-center">
          <ArrowRight className="size-5 text-muted-foreground/50 rotate-90" />
        </div>

        {/* Side-by-side summary cards with distinct colors */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-blue-200 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-950/20">
            <CardContent className="space-y-2">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                For your manager
              </span>
              <div className="text-sm leading-relaxed space-y-2">
                <p>
                  The API migration is delayed to next sprint. Root cause is a dependency on the
                  auth service refactor (ETA Thursday) and a pending compliance security review
                  that&apos;s been unresponsive.
                </p>
                <p>
                  Sarah will escalate to VP Eng if compliance doesn&apos;t respond by Friday. The
                  team is evaluating a fallback plan given a client demo in three weeks. No action
                  needed from you yet.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-950/20">
            <CardContent className="space-y-2">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                For the team
              </span>
              <div className="text-sm leading-relaxed space-y-2">
                <p className="font-medium">Action items:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">James:</span> Complete auth
                    service refactor by Thursday
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Sarah:</span> Escalate compliance
                    review to VP Eng if no response by Friday
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Marcus:</span> Scope fallback plan
                    for client demo (3-week deadline)
                  </li>
                  <li>Flag compliance blocker in sprint retro</li>
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

function CTAFooterSection({
  onTryFree,
  onSignUp,
}: Pick<LandingPageProps, 'onTryFree' | 'onSignUp'>) {
  return (
    <section className="py-12 px-4">
      <div className="max-w-lg mx-auto text-center space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Ready to try it?</h2>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" onClick={onTryFree}>
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
      <HeroSection onTryFree={onTryFree} onSignUp={onSignUp} onSignIn={onSignIn} />
      <BeforeAfterSection />
      <HowItWorksSection />
      <CTAFooterSection onTryFree={onTryFree} onSignUp={onSignUp} />
    </main>
  );
}
