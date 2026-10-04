import { NextResponse, type NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard', '/accounts', '/storage', '/stream', '/tools', '/settings', '/proxy', '/contact'];
const guestRoutes = ['/login'];
const retiredRoutes = ['/topup', '/packages'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (retiredRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  const isProtected = protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isGuest = guestRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const token = request.cookies.get('gujalive_access_token')?.value ?? request.cookies.get('gujalive_token')?.value;

  if (isProtected && !token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isGuest && token) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'] };
