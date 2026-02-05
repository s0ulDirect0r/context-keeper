import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { marked } from "marked"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Copy text with both HTML (for rich paste) and plain text (fallback)
 */
export async function copyRichText(markdown: string): Promise<void> {
  const html = await marked(markdown);
  const plainText = markdown
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1');

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      }),
    ]);
  } catch {
    // Fallback for browsers that don't support ClipboardItem
    await navigator.clipboard.writeText(plainText);
  }
}
