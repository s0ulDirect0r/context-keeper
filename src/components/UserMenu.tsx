'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { AuthDialog } from '@/components/AuthDialog';
import { Button } from '@/components/ui/button';
import { User, LogOut, LayoutDashboard } from 'lucide-react';

export function UserMenu() {
  const { user, loading, signOut } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  if (loading) {
    return (
      <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
    );
  }

  if (!user) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setAuthDialogOpen(true)}>
          Sign in
        </Button>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      </>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/dashboard">
        <Button variant="ghost" size="sm">
          <LayoutDashboard className="h-4 w-4 mr-1" />
          Dashboard
        </Button>
      </Link>
      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted text-sm">
        <User className="h-4 w-4 text-muted-foreground" />
        <span className="max-w-[150px] truncate">{user.email}</span>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={signOut} title="Sign out">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
