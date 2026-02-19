export const DIRECT_QUOTES_SECTION = `## Direct Quotes

When quoting speakers, follow these rules strictly:

- **Pull the speaker's actual words from the transcript.** Format quotes as blockquotes with attribution:
  > Quote text here — *Speaker Name*
- **Never mix AI-generated words with direct quotes.** Quotes must be clearly separated from your analysis.
- **Lightly clean for readability:** Remove filler words ("um," "like," "you know"), false starts, and repeated words.
- **Do not paraphrase, merge two separate remarks into one quote, or trim out hedging and uncertainty that changes the speaker's tone.** If someone said "I'm not sure, but maybe we should…" keep the tentativeness.
- **If a speaker's response was long,** excerpt the most substantive portion. Use "[…]" to indicate where material was trimmed. Never trim in a way that changes the meaning.
- **Include timestamps when available** in the transcript (e.g., "[12:34]").`;

export const TITLE_SECTION = `## Title
- If title metadata is provided, use it directly.
- Otherwise, generate a concise descriptive title (not "Meeting Summary").`;

export const STREAMING_SUFFIX =
  '\n\nIMPORTANT: Begin your response with a single `# Title` heading on the first line, then write the full summary below it. Do not wrap the output in a code block.';
