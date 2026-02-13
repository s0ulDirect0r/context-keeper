'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useAppMode } from '@/components/AppModeProvider';
import { AuthDialog } from '@/components/AuthDialog';
import { Button } from '@/components/ui/button';
import { Plus, LayoutDashboard, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NavBar() {
  const { user, loading, signOut } = useAuth();
  const { isAppMode } = useAppMode();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const pathname = usePathname();

  // Hide nav on landing page for non-authenticated users (unless they're in app mode)
  if (!user && !loading && pathname === '/' && !isAppMode) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-lg">
            Cedar
          </Link>

          {user && (
            <nav className="hidden sm:flex items-center gap-1">
              <Link href="/">
                <Button variant="ghost" size="sm" className={cn(pathname === '/' && 'bg-muted')}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Summary
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(pathname === '/dashboard' && 'bg-muted')}
                >
                  <LayoutDashboard className="h-4 w-4 mr-1" />
                  Dashboard
                </Button>
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {loading ? (
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
          ) : user ? (
            <>
              <span className="hidden sm:block text-sm text-muted-foreground max-w-[200px] truncate">
                {user.email}
              </span>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setAuthDialogOpen(true)}>
                Sign in
              </Button>
              <Button size="sm" onClick={() => setAuthDialogOpen(true)}>
                Sign up
              </Button>
              <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
            </>
          )}
        </div>
      </div>

      {/* Mobile nav for logged-in users */}
      {user && (
        <div className="sm:hidden border-t px-4 py-2 flex gap-2">
          <Link href="/" className="flex-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn('w-full justify-start', pathname === '/' && 'bg-muted')}
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </Link>
          <Link href="/dashboard" className="flex-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn('w-full justify-start', pathname === '/dashboard' && 'bg-muted')}
            >
              <LayoutDashboard className="h-4 w-4 mr-1" />
              Dashboard
            </Button>
          </Link>
        </div>
      )}
    </header>
  );
}
