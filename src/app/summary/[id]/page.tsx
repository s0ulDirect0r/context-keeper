import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { toSavedSummary, type Database } from '@/lib/supabase/types';
import { SummaryView } from '@/components/summary/SummaryView';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

type SummaryRow = Database['public']['Tables']['summaries']['Row'];

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SummaryPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { data: row, error } = await supabase
    .from('summaries')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !row) {
    notFound();
  }

  const summary = toSavedSummary(row as SummaryRow);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <SummaryView summary={summary} />
      </div>
    </div>
  );
}
