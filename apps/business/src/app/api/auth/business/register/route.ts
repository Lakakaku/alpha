import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { registerBusinessAccount, validateBusinessRegistration } from '@vocilia/auth/business/registration';

export interface BusinessRegistrationRequest {
  email: string;
  password: string;
  businessName: string;
  contactPerson: string;
  phoneNumber: string;
  address?: string;
  businessType?: string;
  estimatedMonthlyCustomers?: number;
}

export interface BusinessRegistrationResponse {
  id: string;
  email: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
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
    
    // Parse request body
    let body: BusinessRegistrationRequest;
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
    const requiredFields = ['email', 'password', 'businessName', 'contactPerson', 'phoneNumber'];
    const missingFields = requiredFields.filter(field => !body[field as keyof BusinessRegistrationRequest]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Missing required fields',
          details: missingFields.map(field => `${field} is required`)
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Map request to internal format
    const registrationData = {
      email: body.email,
      password: body.password,
      businessName: body.businessName,
      contactPerson: body.contactPerson,
      phone: body.phoneNumber,
      address: body.address || '',
      businessType: body.businessType || 'other',
      estimatedMonthlyCustomers: body.estimatedMonthlyCustomers || 100
    };

    // Validate business registration data
    const validation = validateBusinessRegistration(registrationData);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Invalid registration data',
          details: validation.errors.map(e => `${e.field}: ${e.message}`)
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Check for existing user with same email
    const { data: existingUser, error: userCheckError } = await supabase
      .from('business_accounts')
      .select('user_id, email')
      .eq('email', body.email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json(
        {
          error: 'email_exists',
          message: 'Business email already registered'
        } as ErrorResponse,
        { status: 409 }
      );
    }

    // Perform registration
    const result = await registerBusinessAccount(registrationData);

    if (!result.success) {
      // Check for specific error types
      if (result.error?.includes('email')) {
        return NextResponse.json(
          {
            error: 'email_exists',
            message: result.error
          } as ErrorResponse,
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error: 'registration_failed',
          message: result.error || 'Registration failed'
        } as ErrorResponse,
        { status: 422 }
      );
    }

    // Get the created business account to return proper response
    const { data: businessAccount, error: fetchError } = await supabase
      .from('business_accounts')
      .select('user_id, email, verification_status')
      .eq('email', body.email.toLowerCase())
      .single();

    if (fetchError || !businessAccount) {
      console.error('Failed to fetch created business account:', fetchError);
      return NextResponse.json(
        {
          error: 'registration_failed',
          message: 'Account created but failed to retrieve details'
        } as ErrorResponse,
        { status: 422 }
      );
    }

    // Return success response
    const response: BusinessRegistrationResponse = {
      id: businessAccount.user_id,
      email: businessAccount.email,
      verificationStatus: businessAccount.verification_status,
      message: result.requiresEmailVerification 
        ? 'Account created successfully. Please verify your email and wait for admin approval.'
        : 'Account created successfully. Pending admin approval.'
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Business registration error:', error);
    
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred during registration'
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