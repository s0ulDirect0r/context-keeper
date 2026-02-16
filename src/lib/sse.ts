/**
 * Shared SSE (Server-Sent Events) stream parser.
 *
 * The /api/summarize endpoint returns an SSE stream. This was previously
 * parsed inline in page.tsx; extracted here so both page.tsx (generation)
 * and SummaryView.tsx (regeneration) can consume it correctly.
 */

/**
 * Consume an SSE response, calling onEvent for each parsed event.
 * Returns when the stream closes.
 */
export async function consumeSSE(
  response: Response,
  onEvent: (event: string, data: Record<string, unknown>) => void,
): Promise<void> {
  if (!response.body) throw new Error('Response has no body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by double newlines
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const eventStr of events) {
      if (!eventStr.trim()) continue;

      let eventName = '';
      let eventData = '';

      for (const line of eventStr.split('\n')) {
        if (line.startsWith('event: ')) eventName = line.slice(7);
        else if (line.startsWith('data: ')) eventData = line.slice(6);
      }

      if (eventName && eventData) {
        onEvent(eventName, JSON.parse(eventData));
      }
    }
  }
}

/**
 * Consume an SSE stream and return the final `complete` event's data.
 * Throws on `error` events. Used by handleRegenerate where we don't
 * need incremental streaming — just the final result.
 */
export async function consumeSSEToCompletion(
  response: Response,
): Promise<{ savedSummaryId?: string; summaries?: string[]; tags?: unknown[] }> {
  let result: Record<string, unknown> = {};
  await consumeSSE(response, (event, data) => {
    if (event === 'complete') result = data;
    if (event === 'error') throw new Error((data.message as string) || 'SSE error');
  });
  return result as { savedSummaryId?: string; summaries?: string[]; tags?: unknown[] };
}
