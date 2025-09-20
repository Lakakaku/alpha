import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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

export interface StoreListResponse {
  stores: Store[];
  total: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: string[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json(
        {
          error: 'not_authenticated',
          message: 'Authentication required'
        } as ErrorResponse,
        { status: 401 }
      );
    }

    // Get business account for the authenticated user
    const { data: businessAccount, error: businessError } = await supabase
      .from('business_accounts')
      .select('id, verification_status')
      .eq('user_id', session.user.id)
      .single();

    if (businessError || !businessAccount) {
      return NextResponse.json(
        {
          error: 'business_not_found',
          message: 'Business account not found'
        } as ErrorResponse,
        { status: 403 }
      );
    }

    // Check if business account is approved
    if (businessAccount.verification_status !== 'approved') {
      return NextResponse.json(
        {
          error: 'account_not_approved',
          message: 'Business account is not approved'
        } as ErrorResponse,
        { status: 403 }
      );
    }

    // Get stores accessible to this business account
    const { data: businessStores, error: storesError } = await supabase
      .from('business_stores')
      .select(`
        store_id,
        permissions,
        stores (
          id,
          name,
          address,
          qr_code,
          business_id,
          created_at,
          updated_at
        )
      `)
      .eq('business_account_id', businessAccount.id);

    if (storesError) {
      console.error('Failed to fetch stores:', storesError);
      return NextResponse.json(
        {
          error: 'fetch_failed',
          message: 'Failed to fetch store data'
        } as ErrorResponse,
        { status: 500 }
      );
    }

    // Transform data to match API contract
    const stores: Store[] = (businessStores || []).map((bs: any) => ({
      id: bs.stores?.id,
      name: bs.stores?.name,
      address: bs.stores?.address,
      qrCodeId: bs.stores?.qr_code,
      permissions: {
        readFeedback: bs.permissions?.read_feedback || false,
        writeContext: bs.permissions?.write_context || false,
        manageQr: bs.permissions?.manage_qr || false,
        viewAnalytics: bs.permissions?.view_analytics || false,
        admin: bs.permissions?.admin || false
      },
      isActive: true // All returned stores are considered active
    }));

    // Sort stores by name for consistent ordering
    stores.sort((a, b) => a.name.localeCompare(b.name));

    const response: StoreListResponse = {
      stores,
      total: stores.length
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Store list error:', error);
    
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred while fetching stores'
      } as ErrorResponse,
      { status: 500 }
    );
  }
}

// Handle store creation (POST)
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verify authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return NextResponse.json(
        {
          error: 'not_authenticated',
          message: 'Authentication required'
        } as ErrorResponse,
        { status: 401 }
      );
    }

    // Parse request body
    let body: { name: string; address: string };
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
    if (!body.name || !body.address) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Name and address are required',
          details: [
            !body.name ? 'name is required' : '',
            !body.address ? 'address is required' : ''
          ].filter(Boolean)
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Get business account
    const { data: businessAccount, error: businessError } = await supabase
      .from('business_accounts')
      .select('id, verification_status')
      .eq('user_id', session.user.id)
      .single();

    if (businessError || !businessAccount) {
      return NextResponse.json(
        {
          error: 'business_not_found',
          message: 'Business account not found'
        } as ErrorResponse,
        { status: 403 }
      );
    }

    if (businessAccount.verification_status !== 'approved') {
      return NextResponse.json(
        {
          error: 'account_not_approved',
          message: 'Business account is not approved'
        } as ErrorResponse,
        { status: 403 }
      );
    }

    // Generate QR code for the store
    const qrCode = generateQRCode();

    // Create new store
    const { data: newStore, error: createError } = await supabase
      .from('stores')
      .insert({
        name: body.name.trim(),
        address: body.address.trim(),
        business_id: businessAccount.id,
        qr_code: qrCode,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError || !newStore) {
      console.error('Failed to create store:', createError);
      return NextResponse.json(
        {
          error: 'creation_failed',
          message: 'Failed to create store'
        } as ErrorResponse,
        { status: 500 }
      );
    }

    // Grant admin permissions to the business account for this store
    const { error: permissionError } = await supabase
      .from('business_stores')
      .insert({
        business_account_id: businessAccount.id,
        store_id: newStore.id,
        permissions: {
          read_feedback: true,
          write_context: true,
          manage_qr: true,
          view_analytics: true,
          admin: true
        },
        created_at: new Date().toISOString()
      });

    if (permissionError) {
      // Cleanup: delete the store if permission assignment fails
      await supabase.from('stores').delete().eq('id', newStore.id);
      
      console.error('Failed to assign store permissions:', permissionError);
      return NextResponse.json(
        {
          error: 'permission_failed',
          message: 'Failed to assign store permissions'
        } as ErrorResponse,
        { status: 500 }
      );
    }

    // Return the created store
    const store: Store = {
      id: newStore.id,
      name: newStore.name,
      address: newStore.address,
      qrCodeId: newStore.qr_code,
      permissions: {
        readFeedback: true,
        writeContext: true,
        manageQr: true,
        viewAnalytics: true,
        admin: true
      },
      isActive: true
    };

    return NextResponse.json(store, { status: 201 });

  } catch (error) {
    console.error('Store creation error:', error);
    
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred while creating store'
      } as ErrorResponse,
      { status: 500 }
    );
  }
}

// Handle unsupported HTTP methods
export async function PUT() {
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      message: 'PUT method not supported for this endpoint. Use /business/stores/{id} for updates'
    } as ErrorResponse,
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      message: 'DELETE method not supported for this endpoint. Use /business/stores/{id} for deletion'
    } as ErrorResponse,
    { status: 405 }
  );
}

/**
 * Generates a unique QR code for a store
 */
function generateQRCode(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `VCL-${timestamp}-${random}`.toUpperCase();
}