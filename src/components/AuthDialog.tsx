'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type AuthMode = 'sign-in' | 'sign-up' | 'magic-link' | 'check-email';

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: AuthMode;
}

export function AuthDialog({ open, onOpenChange, initialMode = 'sign-in' }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync mode when the dialog opens with a different initialMode
  useEffect(() => {
    if (open) setMode(initialMode);
  }, [open, initialMode]);

  const supabase = createClient();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      onOpenChange(false);
      resetForm();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setMode('check-email');
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setMode('check-email');
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setError(null);
    setMode(initialMode);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'sign-in' && 'Sign in'}
            {mode === 'sign-up' && 'Create account'}
            {mode === 'magic-link' && 'Magic link'}
            {mode === 'check-email' && 'Check your email'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'sign-in' && 'Sign in to save your summaries'}
            {mode === 'sign-up' && 'Create an account to save your summaries'}
            {mode === 'magic-link' && "We'll send you a link to sign in"}
            {mode === 'check-email' && "We've sent you a link to complete sign in"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {mode === 'check-email' ? (
          <div className="space-y-4 text-center py-4">
            <p className="text-muted-foreground">
              Click the link in your email to complete sign in.
            </p>
            <Button variant="outline" onClick={() => setMode('sign-in')}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {(mode === 'sign-in' || mode === 'sign-up') && (
              <form onSubmit={mode === 'sign-in' ? handleSignIn : handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Loading...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
                </Button>
              </form>
            )}

            {mode === 'magic-link' && (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="magic-email">Email</Label>
                  <Input
                    id="magic-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending...' : 'Send magic link'}
                </Button>
              </form>
            )}

            {mode !== 'magic-link' && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setMode('magic-link')}
                disabled={loading}
              >
                Sign in with magic link
              </Button>
            )}

            <div className="text-center text-sm">
              {mode === 'sign-in' ? (
                <p>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => setMode('sign-up')}
                  >
                    Sign up
                  </button>
                </p>
              ) : mode === 'sign-up' ? (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => setMode('sign-in')}
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <p>
                  <button
                    type="button"
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => setMode('sign-in')}
                  >
                    Back to sign in
                  </button>
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
