const TIMESTAMP_RE = /^\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/;
const SEQUENCE_NUM_RE = /^\d+$/;

/** Parse SRT subtitle content into plain text. */
function parseSrt(content: string): string {
  return content
    .split(/\n\n+/)
    .map((block) =>
      block
        .split('\n')
        .filter((line) => !SEQUENCE_NUM_RE.test(line.trim()) && !TIMESTAMP_RE.test(line.trim()))
        .join('\n')
        .trim(),
    )
    .filter(Boolean)
    .join('\n');
}

/** Parse WebVTT subtitle content into plain text. */
function parseVtt(content: string): string {
  const lines = content.split('\n');

  // Strip WEBVTT header (first non-empty line)
  const headerIdx = lines.findIndex((l) => l.trim().length > 0);
  if (headerIdx !== -1 && lines[headerIdx].trim().startsWith('WEBVTT')) {
    lines.splice(headerIdx, 1);
  }

  // Rejoin and strip NOTE blocks (NOTE ... followed by blank line)
  const withoutNotes = lines.join('\n').replace(/^NOTE\b[^\n]*(?:\n(?!\n)[^\n]*)*/gm, '');

  return parseSrt(withoutNotes);
}

const SUPPORTED_EXTENSIONS = ['.txt', '.srt', '.vtt'] as const;
type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/** Returns true if the filename has a supported extension. */
export function isSupportedFile(fileName: string): boolean {
  const ext = getExtension(fileName);
  return ext !== null;
}

function getExtension(fileName: string): SupportedExtension | null {
  const lower = fileName.toLowerCase();
  const found = SUPPORTED_EXTENSIONS.find((ext) => lower.endsWith(ext));
  return found ?? null;
}

/** Parse a transcript file based on its extension. Returns the cleaned text. */
export function parseTranscriptFile(content: string, fileName: string): string {
  const ext = getExtension(fileName);
  switch (ext) {
    case '.srt':
      return parseSrt(content);
    case '.vtt':
      return parseVtt(content);
    case '.txt':
      return content;
    default:
      throw new Error(`Unsupported file type: ${fileName}`);
  }
}
