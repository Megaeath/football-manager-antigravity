import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getAuthToken } from '@/lib/auth';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isLoginPage = pathname === '/login';
  const isAuthApi = pathname.startsWith('/api/auth/');
  const isTestRoute = pathname.startsWith('/match/test-v2') || pathname === '/api/test-v2-match';
  const isV2ReplayApi = pathname.startsWith('/api/match/') && pathname.endsWith('/v2-sim');

  const cookieValue = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const isAuthed = cookieValue === getAuthToken();

  if (isLoginPage && isAuthed) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  if (!isAuthed && !isLoginPage && !isAuthApi && !isTestRoute && !isV2ReplayApi) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
