import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const tenantToken = request.cookies.get('nova_tenant_token')?.value;
  const adminToken = request.cookies.get('nova_admin_token')?.value;

  // 1. Super Admin Routes (/admin/*)
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') {
      if (adminToken) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return NextResponse.next();
    }

    if (!adminToken) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // 2. Tenant Protected Routes
  const tenantProtectedPaths = [
    '/dashboard',
    '/employees',
    '/attendance',
    '/leave',
    '/shifts',
    '/payroll',
    '/reports',
    '/settings',
    '/tickets',
  ];

  const isTenantProtected = tenantProtectedPaths.some((p) => pathname.startsWith(p));
  if (isTenantProtected) {
    if (!tenantToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // 3. Prevent logged-in users from seeing the tenant login page
  if (pathname === '/login' && tenantToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 4. Enforce strict anti-caching on all protected routes
  const response = NextResponse.next();
  if (isTenantProtected || pathname.startsWith('/admin')) {
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0'
    );
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/employees/:path*',
    '/attendance/:path*',
    '/leave/:path*',
    '/shifts/:path*',
    '/payroll/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/tickets/:path*',
    '/login',
  ],
};
