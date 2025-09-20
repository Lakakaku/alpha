import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export interface SuccessResponse {
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      return NextResponse.json(
        {
          error: 'session_error',
          message: 'Failed to retrieve current session'
        } as ErrorResponse,
        { status: 401 }
      );
    }

    if (!session?.user) {
      return NextResponse.json(
        {
          error: 'not_authenticated',
          message: 'No active session found'
        } as ErrorResponse,
        { status: 401 }
      );
    }

    // Deactivate business session before signing out
    try {
      const { error: sessionUpdateError } = await supabase
        .from('business_sessions')
        .update({ 
          active: false,
          last_activity: new Date().toISOString()
        })
        .eq('user_id', session.user.id)
        .eq('active', true);

      if (sessionUpdateError) {
        console.error('Failed to deactivate business session:', sessionUpdateError);
        // Continue with logout even if session update fails
      }
    } catch (sessionUpdateErr) {
      console.error('Error updating business session:', sessionUpdateErr);
      // Continue with logout even if session update fails
    }

    // Sign out from Supabase Auth
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      return NextResponse.json(
        {
          error: 'signout_failed',
          message: 'Failed to sign out'
        } as ErrorResponse,
        { status: 500 }
      );
    }

    // Return success response
    const response: SuccessResponse = {
      success: true,
      message: 'Logout successful'
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Business logout error:', error);
    
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred during logout'
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