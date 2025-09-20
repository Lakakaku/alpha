/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export interface StoreContextRequest {
  storeId: string
}

export interface StoreContextResponse {
  currentStore: Store
  message: string
}

export interface Store {
  id: string
  name: string
  address: string
  qrCodeId: string
  permissions: StorePermissions
  isActive: boolean
}

export interface StorePermissions {
  readFeedback: boolean
  writeContext: boolean
  manageQr: boolean
  viewAnalytics: boolean
  admin: boolean
}

export interface ErrorResponse {
  error: string
  message: string
  details?: string[]
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify authentication
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.user) {
      return NextResponse.json(
        {
          error: 'not_authenticated',
          message: 'Authentication required',
        } as ErrorResponse,
        { status: 401 }
      )
    }

    // Parse request body
    let body: StoreContextRequest
    try {
      body = await request.json()
    } catch (err) {
      return NextResponse.json(
        {
          error: 'invalid_request',
          message: 'Invalid JSON in request body',
        } as ErrorResponse,
        { status: 400 }
      )
    }

    // Validate required fields
    if (!body.storeId) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'storeId is required',
        } as ErrorResponse,
        { status: 400 }
      )
    }

    // Validate storeId format (should be UUID)
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(body.storeId)) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Invalid storeId format',
        } as ErrorResponse,
        { status: 400 }
      )
    }

    // Get business account for the authenticated user
    const { data: businessAccount, error: businessError } = await supabase
      .from('business_accounts')
      .select('id, verification_status')
      .eq('user_id', session.user.id)
      .single()

    if (businessError || !businessAccount) {
      return NextResponse.json(
        {
          error: 'business_not_found',
          message: 'Business account not found',
        } as ErrorResponse,
        { status: 403 }
      )
    }

    // Check if business account is approved
    if (businessAccount.verification_status !== 'approved') {
      return NextResponse.json(
        {
          error: 'account_not_approved',
          message: 'Business account is not approved',
        } as ErrorResponse,
        { status: 403 }
      )
    }

    // Verify user has access to the specified store
    const { data: businessStore, error: storeAccessError } = await supabase
      .from('business_stores')
      .select(
        `
        store_id,
        permissions,
        stores (
          id,
          name,
          address,
          qr_code,
          business_id
        )
      `
      )
      .eq('business_account_id', businessAccount.id)
      .eq('store_id', body.storeId)
      .single()

    if (storeAccessError || !businessStore) {
      return NextResponse.json(
        {
          error: 'store_access_denied',
          message: 'No access to specified store',
        } as ErrorResponse,
        { status: 403 }
      )
    }

    // Check if store exists and is active
    if (!businessStore.stores) {
      return NextResponse.json(
        {
          error: 'store_not_found',
          message: 'Store not found',
        } as ErrorResponse,
        { status: 404 }
      )
    }

    // Update or create business session with new store context
    const sessionData = {
      user_id: session.user.id,
      business_account_id: businessAccount.id,
      current_store_id: body.storeId,
      active: true,
      last_activity: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error: sessionUpdateError } = await supabase
      .from('business_sessions')
      .upsert(sessionData, {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      })

    if (sessionError) {
      console.error('Failed to update business session:', sessionError)
      return NextResponse.json(
        {
          error: 'session_update_failed',
          message: 'Failed to update store context',
        } as ErrorResponse,
        { status: 500 }
      )
    }

    // Create audit log for store context switch
    try {
      await supabase.from('audit_logs').insert({
        event_type: 'store_context_switch',
        user_id: session.user.id,
        resource_type: 'store',
        resource_id: body.storeId,
        metadata: {
          business_account_id: businessAccount.id,
          store_name: (businessStore as any).stores?.name,
          ip_address:
            request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown',
          user_agent: request.headers.get('user-agent') || 'unknown',
        },
        created_at: new Date().toISOString(),
      })
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError)
      // Don't fail the request if audit logging fails
    }

    // Prepare response
    const currentStore: Store = {
      id: (businessStore as any).stores?.id,
      name: (businessStore as any).stores?.name,
      address: (businessStore as any).stores?.address,
      qrCodeId: (businessStore as any).stores?.qr_code,
      permissions: {
        readFeedback: businessStore.permissions?.read_feedback || false,
        writeContext: businessStore.permissions?.write_context || false,
        manageQr: businessStore.permissions?.manage_qr || false,
        viewAnalytics: businessStore.permissions?.view_analytics || false,
        admin: businessStore.permissions?.admin || false,
      },
      isActive: true,
    }

    const response: StoreContextResponse = {
      currentStore,
      message: 'Store context updated successfully',
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('Store context switch error:', error)

    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred while switching store context',
      } as ErrorResponse,
      { status: 500 }
    )
  }
}

// GET method to retrieve current store context
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Verify authentication
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.user) {
      return NextResponse.json(
        {
          error: 'not_authenticated',
          message: 'Authentication required',
        } as ErrorResponse,
        { status: 401 }
      )
    }

    // Get business account
    const { data: businessAccount, error: businessError } = await supabase
      .from('business_accounts')
      .select('id, verification_status')
      .eq('user_id', session.user.id)
      .single()

    if (businessError || !businessAccount) {
      return NextResponse.json(
        {
          error: 'business_not_found',
          message: 'Business account not found',
        } as ErrorResponse,
        { status: 403 }
      )
    }

    if (businessAccount.verification_status !== 'approved') {
      return NextResponse.json(
        {
          error: 'account_not_approved',
          message: 'Business account is not approved',
        } as ErrorResponse,
        { status: 403 }
      )
    }

    // Get current store from session
    const { data: currentSession, error: currentSessionError } = await supabase
      .from('business_sessions')
      .select(
        `
        current_store_id,
        business_stores!inner (
          permissions,
          stores (
            id,
            name,
            address,
            qr_code
          )
        )
      `
      )
      .eq('user_id', session.user.id)
      .eq('active', true)
      .single()

    if (currentSessionError || !currentSession) {
      return NextResponse.json(
        {
          error: 'no_active_session',
          message: 'No active store context found',
        } as ErrorResponse,
        { status: 404 }
      )
    }

    const currentStore: Store = {
      id: (currentSession.business_stores as any)?.stores?.id,
      name: (currentSession.business_stores as any)?.stores?.name,
      address: (currentSession.business_stores as any)?.stores?.address,
      qrCodeId: (currentSession.business_stores as any)?.stores?.qr_code,
      permissions: {
        readFeedback:
          (currentSession.business_stores as any)?.permissions?.read_feedback || false,
        writeContext:
          (currentSession.business_stores as any)?.permissions?.write_context || false,
        manageQr:
          (currentSession.business_stores as any)?.permissions?.manage_qr || false,
        viewAnalytics:
          (currentSession.business_stores as any)?.permissions?.view_analytics || false,
        admin: (currentSession.business_stores as any)?.permissions?.admin || false,
      },
      isActive: true,
    }

    return NextResponse.json({ currentStore }, { status: 200 })
  } catch (error) {
    console.error('Get current store error:', error)

    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred while retrieving current store',
      } as ErrorResponse,
      { status: 500 }
    )
  }
}

// Handle unsupported HTTP methods
export async function POST() {
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      message:
        'POST method not supported for this endpoint. Use PUT to update store context',
    } as ErrorResponse,
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      message: 'DELETE method not supported for this endpoint',
    } as ErrorResponse,
    { status: 405 }
  )
}
