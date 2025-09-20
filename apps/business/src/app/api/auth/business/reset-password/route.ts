import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export interface PasswordResetRequest {
  email: string;
}

export interface SuccessResponse {
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: string[];
}

// Simple in-memory rate limiting (in production, use Redis or similar)
const resetAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 3;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const attempts = resetAttempts.get(email);
  
  if (!attempts) {
    resetAttempts.set(email, { count: 1, lastAttempt: now });
    return false;
  }
  
  // Reset window if enough time has passed
  if (now - attempts.lastAttempt > WINDOW_MS) {
    resetAttempts.set(email, { count: 1, lastAttempt: now });
    return false;
  }
  
  // Check if too many attempts
  if (attempts.count >= MAX_ATTEMPTS) {
    return true;
  }
  
  // Increment attempt count
  attempts.count++;
  attempts.lastAttempt = now;
  resetAttempts.set(email, attempts);
  
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Parse request body
    let body: PasswordResetRequest;
    try {
      body = await request.json();
    } catch (err) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          message: 'Invalid JSON in request body'
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.email) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Email is required'
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Invalid email format'
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Check rate limiting
    if (isRateLimited(body.email)) {
      return NextResponse.json(
        {
          error: 'rate_limit_exceeded',
          message: 'Too many password reset attempts. Please try again later.'
        } as ErrorResponse,
        { status: 429 }
      );
    }

    // Check if business account exists
    const { data: businessAccount, error: businessError } = await supabase
      .from('business_accounts')
      .select('user_id, email, verification_status')
      .eq('email', body.email.toLowerCase())
      .single();

    if (businessError || !businessAccount) {
      // For security reasons, always return success even if email doesn't exist
      // This prevents email enumeration attacks
      return NextResponse.json(
        {
          success: true,
          message: 'If a business account with this email exists, a password reset link has been sent.'
        } as SuccessResponse,
        { status: 200 }
      );
    }

    // Check if account is approved (only approved accounts can reset password)
    if (businessAccount.verification_status !== 'approved') {
      // Still return success to avoid revealing account status
      return NextResponse.json(
        {
          success: true,
          message: 'If a business account with this email exists, a password reset link has been sent.'
        } as SuccessResponse,
        { status: 200 }
      );
    }

    // Send password reset email
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      body.email,
      {
        redirectTo: `${request.nextUrl.origin}/reset-password?type=recovery`,
      }
    );

    if (resetError) {
      console.error('Password reset error:', resetError);
      
      // Still return success to avoid revealing system errors
      return NextResponse.json(
        {
          success: true,
          message: 'If a business account with this email exists, a password reset link has been sent.'
        } as SuccessResponse,
        { status: 200 }
      );
    }

    // Log password reset attempt for audit purposes
    try {
      await supabase
        .from('audit_logs')
        .insert({
          event_type: 'password_reset_requested',
          user_id: businessAccount.user_id,
          metadata: {
            email: body.email,
            ip_address: request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown'
          },
          created_at: new Date().toISOString()
        });
    } catch (auditError) {
      console.error('Failed to log password reset attempt:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json(
      {
        success: true,
        message: 'If a business account with this email exists, a password reset link has been sent.'
      } as SuccessResponse,
      { status: 200 }
    );

  } catch (error) {
    console.error('Password reset error:', error);
    
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred while processing your request'
      } as ErrorResponse,
      { status: 500 }
    );
  }
}

// Handle unsupported HTTP methods
export async function GET() {
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      message: 'GET method not supported for this endpoint'
    } as ErrorResponse,
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      error: 'method_not_allowed', 
      message: 'PUT method not supported for this endpoint'
    } as ErrorResponse,
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      message: 'DELETE method not supported for this endpoint'
    } as ErrorResponse,
    { status: 405 }
  );
}