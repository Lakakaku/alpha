import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
// Server-side verification functions
interface VerificationDecision {
  approved: boolean;
  notes?: string;
  adminUserId: string;
}

async function validateAdminPermissions(userId: string): Promise<{ hasPermission: boolean; error?: string }> {
  const supabase = createRouteHandlerClient({ cookies });
  
  // Check if user has admin role
  const { data, error } = await supabase
    .from('user_accounts')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return { hasPermission: false, error: 'Failed to verify admin permissions' };
  }
  
  return { hasPermission: data.role === 'admin' };
}

async function approveBusinessRegistration(
  businessId: string,
  decision: VerificationDecision
): Promise<{ success: boolean; error?: string }> {
  const supabase = createRouteHandlerClient({ cookies });
  
  const { error } = await supabase.rpc('approve_business_registration', {
    user_id: businessId,
    notes: decision.notes || null
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

async function rejectBusinessRegistration(
  businessId: string,
  decision: VerificationDecision
): Promise<{ success: boolean; error?: string }> {
  const supabase = createRouteHandlerClient({ cookies });
  
  const { error } = await supabase.rpc('reject_business_registration', {
    user_id: businessId,
    notes: decision.notes || null
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export interface BusinessApprovalRequest {
  businessId: string;
  action: 'approve' | 'reject';
  notes?: string;
}

export interface BusinessApprovalResponse {
  businessId: string;
  newStatus: 'approved' | 'rejected';
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
    
    // Verify admin authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json(
        {
          error: 'not_authenticated',
          message: 'Admin authentication required'
        } as ErrorResponse,
        { status: 401 }
      );
    }

    // Validate admin permissions
    const { hasPermission, error: permissionError } = await validateAdminPermissions(session.user.id);
    
    if (!hasPermission) {
      return NextResponse.json(
        {
          error: 'insufficient_privileges',
          message: permissionError || 'Insufficient admin privileges for business approval'
        } as ErrorResponse,
        { status: 403 }
      );
    }

    // Parse request body
    let body: BusinessApprovalRequest;
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
    if (!body.businessId || !body.action) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'businessId and action are required',
          details: [
            !body.businessId ? 'businessId is required' : '',
            !body.action ? 'action is required' : ''
          ].filter(Boolean)
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Validate action value
    if (!['approve', 'reject'].includes(body.action)) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'action must be either "approve" or "reject"'
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Validate businessId format (should be UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.businessId)) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Invalid businessId format'
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Check if business account exists and is pending
    const { data: businessAccount, error: businessError } = await supabase
      .from('business_accounts')
      .select('id, verification_status, business_name')
      .eq('id', body.businessId)
      .single();

    if (businessError || !businessAccount) {
      return NextResponse.json(
        {
          error: 'business_not_found',
          message: 'Business account not found'
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // Check if business is in pending status
    if (businessAccount.verification_status !== 'pending') {
      return NextResponse.json(
        {
          error: 'invalid_status',
          message: `Business account is already ${businessAccount.verification_status}`
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Prepare verification decision
    const decision: VerificationDecision = {
      approved: body.action === 'approve',
      notes: body.notes,
      adminUserId: session.user.id
    };

    // Perform approval or rejection
    const result = body.action === 'approve' 
      ? await approveBusinessRegistration(body.businessId, decision)
      : await rejectBusinessRegistration(body.businessId, decision);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'approval_failed',
          message: result.error || `Failed to ${body.action} business account`
        } as ErrorResponse,
        { status: 422 }
      );
    }

    // Create audit log entry
    try {
      await supabase
        .from('audit_logs')
        .insert({
          event_type: `business_${body.action}`,
          user_id: session.user.id,
          resource_type: 'business_account',
          resource_id: body.businessId,
          metadata: {
            business_name: businessAccount.business_name,
            action: body.action,
            notes: body.notes,
            ip_address: request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown'
          },
          created_at: new Date().toISOString()
        });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
      // Don't fail the request if audit logging fails
    }

    // Return success response
    const response: BusinessApprovalResponse = {
      businessId: body.businessId,
      newStatus: body.action === 'approve' ? 'approved' : 'rejected',
      message: `Business account ${body.action}d successfully`
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Business approval error:', error);
    
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred during business approval'
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