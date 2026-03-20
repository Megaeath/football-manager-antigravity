import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getAuthToken, isValidCredentials } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body?.username || '');
    const password = String(body?.password || '');

    if (!isValidCredentials(username, password)) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(AUTH_COOKIE_NAME, getAuthToken(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
