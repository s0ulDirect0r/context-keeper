export function buildSearchText(title: string, summaries: Record<string, string>): string {
  const parts = [title];
  for (const text of Object.values(summaries)) {
    parts.push(text);
  }
  // Cap at 50KB to avoid oversized rows
  return parts.join('\n').slice(0, 50_000);
}
