'use client';

import Markdown from 'react-markdown';
import { Loader2, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export type TaskStatus = 'pending' | 'streaming' | 'done' | 'error';

export interface TaskStatuses {
  summary: TaskStatus;
  themes: TaskStatus;
  speakers: TaskStatus;
}

interface Props {
  markdown: string;
  taskStatus: TaskStatuses;
  themesCount: number;
  speakersCount: number;
}

export function StreamingGenerationView({ markdown, taskStatus, themesCount, speakersCount }: Props) {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <Card>
        <CardContent className="pt-6">
          {markdown ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown>{markdown}</Markdown>
              {taskStatus.summary === 'streaming' && (
                <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Generating your summary...</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
        <TaskIndicator label="Summary" status={taskStatus.summary} />
        <TaskIndicator
          label="Themes"
          status={taskStatus.themes}
          detail={themesCount > 0 ? `${themesCount} found` : undefined}
        />
        <TaskIndicator
          label="Speakers"
          status={taskStatus.speakers}
          detail={speakersCount > 0 ? `${speakersCount} found` : undefined}
        />
      </div>
    </div>
  );
}

function TaskIndicator({ label, status, detail }: { label: string; status: TaskStatus; detail?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {status === 'done' ? (
        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
      ) : status === 'error' ? (
        <AlertCircle className="h-4 w-4 text-red-500" />
      ) : (
        <Loader2 className={`h-4 w-4 ${status === 'streaming' ? 'animate-spin' : 'opacity-40'}`} />
      )}
      <span className={status === 'done' ? 'text-foreground' : ''}>
        {label}
        {detail && <span className="text-xs ml-1">({detail})</span>}
      </span>
    </div>
  );
}
