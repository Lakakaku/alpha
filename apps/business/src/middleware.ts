import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define route patterns
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register', 
  '/reset-password',
  '/pending-approval',
  '/auth/callback',
  '/api/auth/business/register',
  '/api/auth/business/login',
  '/api/auth/business/logout',
  '/api/auth/business/reset-password'
];

const PROTECTED_ROUTES = [
  '/dashboard',
  '/api/business/stores',
  '/api/business/current-store'
];

const PENDING_APPROVAL_ROUTES = [
  '/pending-approval'
];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  // Check if the route is public
  if (isPublicRoute(pathname)) {
    // If user is authenticated and trying to access auth pages, redirect to dashboard
    if (session && isAuthRoute(pathname)) {
      // Check business account status before redirecting
      const businessStatus = await getBusinessAccountStatus(supabase, session.user.id);
      
      if (businessStatus === 'pending') {
        url.pathname = '/pending-approval';
        return NextResponse.redirect(url);
      } else if (businessStatus === 'approved') {
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
      // If rejected or not found, allow access to auth pages
    }
    return res;
  }

  // Check if user is authenticated
  if (!session) {
    // Redirect to login for protected routes
    if (isProtectedRoute(pathname)) {
      url.pathname = '/login';
      url.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(url);
    }
    return res;
  }

  // User is authenticated - check business account status
  const businessStatus = await getBusinessAccountStatus(supabase, session.user.id);

  // Handle different business account statuses
  switch (businessStatus) {
    case 'not_found':
      // Business account not found - redirect to register
      if (pathname !== '/register') {
        url.pathname = '/register';
        return NextResponse.redirect(url);
      }
      break;

    case 'pending':
      // Business account pending approval
      if (!isPendingApprovalRoute(pathname)) {
        url.pathname = '/pending-approval';
        return NextResponse.redirect(url);
      }
      break;

    case 'rejected':
      // Business account rejected - redirect to contact support page
      if (pathname !== '/account-rejected') {
        url.pathname = '/account-rejected';
        return NextResponse.redirect(url);
      }
      break;

    case 'approved':
      // Business account approved - allow access to protected routes
      if (isPendingApprovalRoute(pathname)) {
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
      
      // For API routes, add business context headers
      if (pathname.startsWith('/api/business/')) {
        const businessAccount = await getBusinessAccount(supabase, session.user.id);
        if (businessAccount) {
          const requestHeaders = new Headers(req.headers);
          requestHeaders.set('x-business-account-id', businessAccount.id);
          requestHeaders.set('x-business-verification-status', businessAccount.verification_status);
          
          return NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
        }
      }
      break;

    default:
      // Unknown status - redirect to login
      url.pathname = '/login';
      return NextResponse.redirect(url);
  }

  return res;
}

/**
 * Checks if a route is public (doesn't require authentication)
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => {
    if (route === pathname) return true;
    
    // Handle dynamic routes and wildcards
    if (route.includes('*')) {
      const pattern = route.replace('*', '.*');
      return new RegExp(`^${pattern}`).test(pathname);
    }
    
    return false;
  });
}

/**
 * Checks if a route is protected (requires authentication)
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => {
    if (pathname.startsWith(route)) return true;
    return false;
  });
}

/**
 * Checks if a route is an authentication route (login, register, etc.)
 */
function isAuthRoute(pathname: string): boolean {
  const authRoutes = ['/login', '/register', '/reset-password'];
  return authRoutes.includes(pathname);
}

/**
 * Checks if a route is for pending approval
 */
function isPendingApprovalRoute(pathname: string): boolean {
  return PENDING_APPROVAL_ROUTES.includes(pathname);
}

/**
 * Gets the business account status for a user
 */
async function getBusinessAccountStatus(supabase: any, userId: string): Promise<string> {
  try {
    const { data: businessAccount, error } = await supabase
      .from('business_accounts')
      .select('verification_status')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // No business account found
      return 'not_found';
    }

    if (error) {
      console.error('Error fetching business account:', error);
      return 'error';
    }

    return businessAccount?.verification_status || 'not_found';
  } catch (err) {
    console.error('Exception in getBusinessAccountStatus:', err);
    return 'error';
  }
}

/**
 * Gets the full business account data for a user
 */
async function getBusinessAccount(supabase: any, userId: string) {
  try {
    const { data: businessAccount, error } = await supabase
      .from('business_accounts')
      .select('id, verification_status, business_name')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching business account:', error);
      return null;
    }

    return businessAccount;
  } catch (err) {
    console.error('Exception in getBusinessAccount:', err);
    return null;
  }
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}