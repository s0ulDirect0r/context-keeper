import { z } from 'zod';
import { NextResponse } from 'next/server';
import { otterLogin } from '@/lib/otter';
import { createRateLimiter } from '@/lib/rate-limit';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// 5 requests per minute per IP (login brute-force protection)
const limiter = createRateLimiter({ limit: 5, windowMs: 60 * 1000 });

export async function POST(request: Request) {
  // Rate limit check
  const { allowed, retryAfter } = limiter.check(request);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  try {
    const body = await request.json();

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    const session = await otterLogin(email, password);

    return NextResponse.json({
      success: true,
      userId: session.userId,
      cookies: session.cookies,
      csrfToken: session.csrfToken,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
