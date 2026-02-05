import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert markdown to plain text by stripping syntax
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    // Remove headers but keep text
    .replace(/^#{1,6}\s+(.*)$/gm, '$1')
    // Remove bold/italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/___(.+?)___/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Remove inline code
    .replace(/`(.+?)`/g, '$1')
    // Remove links but keep text
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    // Remove images
    .replace(/!\[.*?\]\(.+?\)/g, '')
    // Convert bullet points to dashes
    .replace(/^\s*[\*\-]\s+/gm, '- ')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, '')
    // Trim extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
