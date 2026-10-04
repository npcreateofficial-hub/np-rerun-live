import { NextResponse, type NextRequest } from 'next/server';

const protectedRoutes = ['/', '/users', '/packages', '/notifications'];
const retiredRoutes = ['/sales', '/payments', '/system'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (retiredRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  const isProtected = protectedRoutes.some((route) => pathname === route || (route !== '/' && pathname.startsWith(`${route}/`)));
  const token = request.cookies.get('gujalive_admin_access_token')?.value;

  if (isProtected && !token && pathname !== '/login') {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/login' && token) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
