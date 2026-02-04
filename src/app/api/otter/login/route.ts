import { NextResponse } from 'next/server';
import { otterLogin } from '@/lib/otter';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

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
