import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export interface BusinessLoginRequest {
  email: string;
  password: string;
}

export interface BusinessLoginResponse {
  user: BusinessUser;
  session: SessionInfo;
  stores: Store[];
  currentStore: Store | null;
}

export interface BusinessUser {
  id: string;
  email: string;
  businessName: string;
  contactPerson: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface SessionInfo {
  id: string;
  expiresAt: string;
  lastActivity: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  qrCodeId: string;
  permissions: StorePermissions;
  isActive: boolean;
}

export interface StorePermissions {
  readFeedback: boolean;
  writeContext: boolean;
  manageQr: boolean;
  viewAnalytics: boolean;
  admin: boolean;
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
    let body: BusinessLoginRequest;
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
    if (!body.email || !body.password) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Email and password are required'
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Rate limiting check could be added here
    // For now, we'll implement basic validation

    // Attempt authentication
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (signInError) {
      // Return generic error for security (don't reveal if email exists)
      return NextResponse.json(
        {
          error: 'invalid_credentials',
          message: 'Invalid email or password'
        } as ErrorResponse,
        { status: 401 }
      );
    }

    if (!authData.user || !authData.session) {
      return NextResponse.json(
        {
          error: 'authentication_failed',
          message: 'Authentication failed'
        } as ErrorResponse,
        { status: 401 }
      );
    }

    // Optimize: Fetch business account and stores in parallel
    const [businessAccountResult, businessStoresResult] = await Promise.all([
      supabase
        .from('business_accounts')
        .select('id, business_name, contact_person, verification_status, created_at')
        .eq('user_id', authData.user.id)
        .single(),
      supabase
        .from('business_stores')
        .select(`
          store_id,
          permissions,
          stores (
            id,
            name,
            address,
            qr_code
          )
        `)
        .eq('business_account_id', authData.user.id) // Direct join optimization
    ]);

    const { data: businessAccount, error: businessError } = businessAccountResult;
    const { data: businessStores, error: storesError } = businessStoresResult;

    if (businessError || !businessAccount) {
      // Sign out user if no business account found
      await supabase.auth.signOut();
      return NextResponse.json(
        {
          error: 'account_not_found',
          message: 'Business account not found'
        } as ErrorResponse,
        { status: 403 }
      );
    }

    // Check verification status
    if (businessAccount.verification_status !== 'approved') {
      await supabase.auth.signOut();
      
      const message = businessAccount.verification_status === 'pending' 
        ? 'Your business account is pending admin approval'
        : 'Your business account has been rejected or suspended';
        
      return NextResponse.json(
        {
          error: 'account_not_approved',
          message
        } as ErrorResponse,
        { status: 403 }
      );
    }

    if (storesError) {
      console.error('Failed to load stores:', storesError);
    }

    const stores: Store[] = (businessStores || []).map(bs => ({
      id: bs.stores.id,
      name: bs.stores.name,
      address: bs.stores.address,
      qrCodeId: bs.stores.qr_code,
      permissions: {
        readFeedback: bs.permissions?.read_feedback || false,
        writeContext: bs.permissions?.write_context || false,
        manageQr: bs.permissions?.manage_qr || false,
        viewAnalytics: bs.permissions?.view_analytics || false,
        admin: bs.permissions?.admin || false
      },
      isActive: true
    }));

    // Optimize: Parallel session lookup and preparation
    let currentStore: Store | null = null;
    const sessionLookupPromise = supabase
      .from('business_sessions')
      .select('current_store_id')
      .eq('user_id', authData.user.id)
      .eq('active', true)
      .single();

    // Process stores while session lookup is happening
    if (stores.length > 0) {
      currentStore = stores[0]; // Default to first store
    }

    // Check for existing session
    const { data: existingSession } = await sessionLookupPromise;
    if (existingSession?.current_store_id && stores.find(s => s.id === existingSession.current_store_id)) {
      currentStore = stores.find(s => s.id === existingSession.current_store_id) || currentStore;
    }

    // Optimize: Fire and forget session update (non-blocking)
    const now = new Date().toISOString();
    supabase
      .from('business_sessions')
      .upsert({
        user_id: authData.user.id,
        business_account_id: businessAccount.id,
        current_store_id: currentStore?.id || null,
        active: true,
        last_activity: now
      }, {
        onConflict: 'user_id'
      })
      .then(({ error }) => {
        if (error) {
          console.error('Session update failed:', error);
        }
      });

    // Prepare response
    const user: BusinessUser = {
      id: authData.user.id,
      email: authData.user.email || '',
      businessName: businessAccount.business_name,
      contactPerson: businessAccount.contact_person,
      verificationStatus: businessAccount.verification_status,
      createdAt: businessAccount.created_at
    };

    const session: SessionInfo = {
      id: authData.session.access_token,
      expiresAt: new Date(authData.session.expires_at! * 1000).toISOString(),
      lastActivity: new Date().toISOString()
    };

    const response: BusinessLoginResponse = {
      user,
      session,
      stores,
      currentStore
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Business login error:', error);
    
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred during login'
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