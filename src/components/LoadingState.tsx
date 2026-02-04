'use client';

import { Card, CardContent } from '@/components/ui/card';

interface Props {
  message?: string;
}

export function LoadingState({ message = 'Generating your summary...' }: Props) {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="py-12">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-muted" />
            <div className="absolute top-0 left-0 h-12 w-12 rounded-full border-4 border-t-primary animate-spin" />
          </div>
          <p className="text-muted-foreground text-center">{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}
