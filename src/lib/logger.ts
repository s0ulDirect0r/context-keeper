import * as Sentry from '@sentry/nextjs';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

const MAX_STRING_LENGTH = 2000;
const MAX_DEPTH = 5;

/** JSON replacer that handles circular refs and truncates large strings */
function safeReplacer() {
  const seen = new WeakSet();
  return (_key: string, value: unknown): unknown => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    if (typeof value === 'string' && value.length > MAX_STRING_LENGTH) {
      return value.slice(0, MAX_STRING_LENGTH) + `... [truncated ${value.length} chars]`;
    }
    return value;
  };
}

/** Safely stringify context, respecting depth limits */
function safeStringify(obj: unknown, pretty = false): string {
  try {
    return JSON.stringify(obj, safeReplacer(), pretty ? 2 : undefined);
  } catch {
    return '[unserializable]';
  }
}

/** Extract error details for structured logging */
function errorContext(error?: Error | unknown): Record<string, string> | undefined {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorName: error.name,
      ...(error.stack
        ? { errorStack: error.stack.split('\n').slice(0, MAX_DEPTH).join('\n') }
        : {}),
    };
  }
  return { errorMessage: String(error) };
}

function log(level: LogLevel, message: string, context?: LogContext, error?: Error | unknown) {
  const mergedContext = { ...context, ...errorContext(error) };

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...mergedContext,
  };

  // Production: JSON for Vercel log drain. Development: pretty console.
  const output =
    process.env.NODE_ENV === 'production'
      ? safeStringify(entry)
      : `[${level.toUpperCase()}] ${message}${Object.keys(mergedContext).length > 0 ? ' ' + safeStringify(mergedContext, true) : ''}`;

  const consoleFn =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  consoleFn(output);

  // Auto-forward errors to Sentry
  if (level === 'error') {
    const err = error instanceof Error ? error : new Error(message);
    Sentry.captureException(err, {
      tags: {
        route: context?.route as string | undefined,
        requestId: context?.requestId as string | undefined,
      },
      extra: mergedContext,
    });
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log('debug', msg, ctx),
  info: (msg: string, ctx?: LogContext) => log('info', msg, ctx),
  warn: (msg: string, ctx?: LogContext, error?: Error | unknown) => log('warn', msg, ctx, error),
  error: (msg: string, ctx?: LogContext, error?: Error | unknown) => log('error', msg, ctx, error),
};
