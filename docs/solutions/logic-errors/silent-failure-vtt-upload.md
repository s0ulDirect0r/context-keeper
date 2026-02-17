---
title: 'Silent failure when uploading VTT-formatted .txt transcripts'
date: 2026-02-16
category: logic-errors
tags:
  - error-handling
  - file-upload
  - transcript-parsing
  - react-reducer
  - state-management
  - sse
severity: high
components:
  - src/app/page.tsx
  - src/lib/generation-reducer.ts
  - src/lib/transcript-parsers.ts
  - src/components/ManualTranscript.tsx
  - src/app/api/summarize/route.ts
pr: https://github.com/s0ulDirect0r/context-keeper/pull/30
---

# Silent failure when uploading VTT-formatted .txt transcripts

## Problem

A guest user uploaded a VTT-formatted `.txt` file, filled out the context wizard, and was silently bounced back to wizard step 1 with no error message. No indication of what went wrong.

**Symptom:** User completes the entire wizard flow, clicks submit, briefly sees the generating screen, then lands back on step 1 of the wizard with all context lost and no error.

## Root Cause Analysis

Five interconnected bugs, all contributing to the same user experience failure:

### 1. SET_STEP unconditionally clears errors

The reducer's `SET_STEP` action always sets `error: null`:

```typescript
case 'SET_STEP':
  return { ...state, step: action.step, error: null };
```

When the catch block dispatched `SET_ERROR` then `SET_STEP`, React 18 batched both into one render. The final state had `error: null` — the user never saw the error message.

### 2. .txt files got zero content parsing

`parseTranscriptFile` returned `.txt` content as-is with no content sniffing. A VTT-formatted file saved as `.txt` (common with Otter.ai exports) kept all `WEBVTT` headers and `00:07:04.000 --> 00:07:11.000` timestamps, bloating the payload well past the 100KB Zod validation limit.

### 3. Transcript size limit too tight

The 100KB per-transcript limit was too small for real meeting transcripts, especially ones carrying VTT timestamp overhead. Even after stripping timestamps, long meetings can easily exceed 100KB.

### 4. SSE error event was a no-op

```typescript
case 'error':
  break;  // silently swallowed
```

Server errors during streaming left users stuck on the generating step indefinitely.

### 5. No client-side file size validation

Users could upload arbitrarily large files, go through the entire wizard, and only get rejected by the server at submission time.

## Solution

### Atomic reducer actions (generation-reducer.ts)

Added two actions that set step and error together, preventing `SET_STEP` from clearing the error:

```typescript
case 'SET_STEP_WITH_ERROR':
  return { ...state, step: action.step, error: action.error };

case 'GENERATION_FAILED':
  return { ...state, step: 'context-wizard', error: action.error, isStreaming: false };
```

### Content sniffing for .txt files (transcript-parsers.ts)

Detect VTT/SRT content inside `.txt` files by checking the content, not just the extension:

```typescript
case '.txt': {
  if (/^\s*WEBVTT\b/i.test(content)) return parseVtt(content);
  const firstLines = content.split('\n', 5);
  if (firstLines.some((l) => TIMESTAMP_RE.test(l.trim()))) return parseSrt(content);
  return content;
}
```

### Wired SSE error event (page.tsx)

```typescript
case 'error':
  dispatch({
    type: 'GENERATION_FAILED',
    error: (data.message as string) || 'Something went wrong during generation',
  });
  break;
```

### Client-side file size validation (ManualTranscript.tsx)

```typescript
if (file.size > 500_000) {
  setFileError('This file is too large. Maximum size is 500KB.');
  return;
}
```

### Raised transcript limit (summarize/route.ts)

100KB to 500KB per transcript to accommodate real-world meeting lengths.

## Verification

Tested with Playwright browser automation:

1. **Reproduced the bug**: 140KB VTT-formatted `.txt` file hit 100KB limit, user silently bounced back
2. **Verified error banner**: After fix, "Validation failed" error displayed correctly
3. **Content sniffing**: VTT headers and timestamps stripped from `.txt` preview (119KB clean text from 140KB raw)
4. **Full flow**: Paste, upload .txt, and upload .vtt all generate summaries successfully
5. **Oversized file**: 555KB file shows "This file is too large" immediately, button stays disabled
6. **Zero console errors** across all test flows

## Prevention

### The root pattern: silent failures from implicit assumptions

- The reducer assumed `SET_STEP` alone controlled the error field
- The parser assumed file extension was sufficient for format detection
- The client assumed the server would validate file size
- The SSE handler assumed errors were optional

### Warning signs in code review

- **Reducer**: Action clears a field as a side effect that another concurrent action sets
- **File parsing**: Extension is the only format check; no content sniffing
- **Validation**: Client can reach expensive operations (API calls) without passing all validation gates
- **SSE/Streaming**: Event handler has a `case` that does nothing (`break` with no action)

### Best practices

- **Atomic actions**: When step transition + error must happen together, use a single action type
- **Content detection**: Never trust file extension alone — sniff content headers
- **Validate at boundaries**: Client-side for fast UX feedback, server-side for safety
- **No silent event consumption**: Every SSE/WebSocket event case must handle, re-throw, or explicitly log
