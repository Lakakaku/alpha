import { createClient, SupabaseClient, Session, User, AuthError } from '@supabase/supabase-js'
import type { Database, UserProfile, LoginRequest, LoginResponse, RefreshRequest, RefreshResponse } from '@vocilia/types'

export interface AuthConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  redirectUrl?: string
  autoRefreshToken?: boolean
  persistSession?: boolean
  detectSessionInUrl?: boolean
  flowType?: 'pkce' | 'implicit'
}

export interface AuthSession {
  user: User
  profile: UserProfile | null
  access_token: string
  refresh_token: string
  expires_at: number
  expires_in: number
}

export interface AuthEventCallbacks {
  onSignIn?: (session: AuthSession) => void | Promise<void>
  onSignOut?: () => void | Promise<void>
  onTokenRefresh?: (session: AuthSession) => void | Promise<void>
  onError?: (error: AuthError) => void | Promise<void>
}

/**
 * Enhanced Supabase Auth client with type safety and additional utilities
 * Provides authentication functionality for the Vocilia platform
 */
export class AuthClient {
  private client: SupabaseClient<Database>
  private config: AuthConfig
  private callbacks: AuthEventCallbacks = {}
  private refreshTimeout: NodeJS.Timeout | null = null

  constructor(config: AuthConfig, callbacks: AuthEventCallbacks = {}) {
    this.config = config
    this.callbacks = callbacks

    this.client = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: config.autoRefreshToken ?? true,
        persistSession: config.persistSession ?? true,
        detectSessionInUrl: config.detectSessionInUrl ?? true,
        flowType: config.flowType ?? 'pkce',
        redirectTo: config.redirectUrl
      },
      global: {
        headers: {
          'x-application': 'vocilia-platform'
        }
      }
    })

    this.setupAuthStateListener()
  }

  /**
   * Get the underlying Supabase client
   */
  getClient(): SupabaseClient<Database> {
    return this.client
  }

  /**
   * Sign in with email and password
   */
  async signIn(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      })

      if (error) {
        throw new AuthError(error.message)
      }

      if (!data.session || !data.user) {
        throw new AuthError('Sign in failed: No session or user returned')
      }

      // Fetch user profile
      const profile = await this.fetchUserProfile(data.user.id)

      const authSession: AuthSession = {
        user: data.user,
        profile,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at!,
        expires_in: data.session.expires_in!
      }

      await this.callbacks.onSignIn?.(authSession)

      return {
        user: profile!,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in!
      }
    } catch (error) {
      const authError = error instanceof AuthError ? error : new AuthError(String(error))
      await this.callbacks.onError?.(authError)
      throw authError
    }
  }

  /**
   * Sign up a new user with email and password
   */
  async signUp(email: string, password: string, metadata?: Record<string, any>) {
    try {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      })

      if (error) {
        throw new AuthError(error.message)
      }

      return {
        user: data.user,
        session: data.session,
        needsConfirmation: !data.session
      }
    } catch (error) {
      const authError = error instanceof AuthError ? error : new AuthError(String(error))
      await this.callbacks.onError?.(authError)
      throw authError
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      const { error } = await this.client.auth.signOut()

      if (error) {
        throw new AuthError(error.message)
      }

      if (this.refreshTimeout) {
        clearTimeout(this.refreshTimeout)
        this.refreshTimeout = null
      }

      await this.callbacks.onSignOut?.()
    } catch (error) {
      const authError = error instanceof AuthError ? error : new AuthError(String(error))
      await this.callbacks.onError?.(authError)
      throw authError
    }
  }

  /**
   * Refresh the current session
   */
  async refreshSession(refreshRequest?: RefreshRequest): Promise<RefreshResponse> {
    try {
      const { data, error } = await this.client.auth.refreshSession(
        refreshRequest ? { refresh_token: refreshRequest.refresh_token } : undefined
      )

      if (error) {
        throw new AuthError(error.message)
      }

      if (!data.session) {
        throw new AuthError('Token refresh failed: No session returned')
      }

      const profile = await this.fetchUserProfile(data.user!.id)

      const authSession: AuthSession = {
        user: data.user!,
        profile,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at!,
        expires_in: data.session.expires_in!
      }

      await this.callbacks.onTokenRefresh?.(authSession)

      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in!
      }
    } catch (error) {
      const authError = error instanceof AuthError ? error : new AuthError(String(error))
      await this.callbacks.onError?.(authError)
      throw authError
    }
  }

  /**
   * Get the current session
   */
  async getSession(): Promise<AuthSession | null> {
    try {
      const { data: { session }, error } = await this.client.auth.getSession()

      if (error) {
        throw new AuthError(error.message)
      }

      if (!session) {
        return null
      }

      const profile = await this.fetchUserProfile(session.user.id)

      return {
        user: session.user,
        profile,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at!,
        expires_in: session.expires_in!
      }
    } catch (error) {
      const authError = error instanceof AuthError ? error : new AuthError(String(error))
      await this.callbacks.onError?.(authError)
      return null
    }
  }

  /**
   * Get the current user
   */
  async getUser(): Promise<User | null> {
    try {
      const { data: { user }, error } = await this.client.auth.getUser()

      if (error) {
        throw new AuthError(error.message)
      }

      return user
    } catch (error) {
      const authError = error instanceof AuthError ? error : new AuthError(String(error))
      await this.callbacks.onError?.(authError)
      return null
    }
  }

  /**
   * Update user profile information
   */
  async updateProfile(updates: { full_name?: string; avatar_url?: string }): Promise<UserProfile> {
    try {
      const user = await this.getUser()
      if (!user) {
        throw new AuthError('No authenticated user found')
      }

      const { data, error } = await this.client
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        throw new AuthError(`Failed to update profile: ${error.message}`)
      }

      return data
    } catch (error) {
      const authError = error instanceof AuthError ? error : new AuthError(String(error))
      await this.callbacks.onError?.(authError)
      throw authError
    }
  }

  /**
   * Change user password
   */
  async changePassword(newPassword: string): Promise<void> {
    try {
      const { error } = await this.client.auth.updateUser({
        password: newPassword
      })

      if (error) {
        throw new AuthError(error.message)
      }
    } catch (error) {
      const authError = error instanceof AuthError ? error : new AuthError(String(error))
      await this.callbacks.onError?.(authError)
      throw authError
    }
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    try {
      const { error } = await this.client.auth.resetPasswordForEmail(email, {
        redirectTo: this.config.redirectUrl
      })

      if (error) {
        throw new AuthError(error.message)
      }
    } catch (error) {
      const authError = error instanceof AuthError ? error : new AuthError(String(error))
      await this.callbacks.onError?.(authError)
      throw authError
    }
  }

  /**
   * Confirm email address
   */
  async confirmEmail(token: string, type: 'signup' | 'recovery' = 'signup'): Promise<AuthSession> {
    try {
      const { data, error } = await this.client.auth.verifyOtp({
        token_hash: token,
        type: type
      })

      if (error) {
        throw new AuthError(error.message)
      }

      if (!data.session || !data.user) {
        throw new AuthError('Email confirmation failed')
      }

      const profile = await this.fetchUserProfile(data.user.id)

      const authSession: AuthSession = {
        user: data.user,
        profile,
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at!,
        expires_in: data.session.expires_in!
      }

      await this.callbacks.onSignIn?.(authSession)

      return authSession
    } catch (error) {
      const authError = error instanceof AuthError ? error : new AuthError(String(error))
      await this.callbacks.onError?.(authError)
      throw authError
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession()
    return session !== null
  }

  /**
   * Set up auth state change listener
   */
  private setupAuthStateListener(): void {
    this.client.auth.onAuthStateChange(async (event, session) => {
      try {
        switch (event) {
          case 'SIGNED_IN':
            if (session?.user) {
              const profile = await this.fetchUserProfile(session.user.id)
              const authSession: AuthSession = {
                user: session.user,
                profile,
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at!,
                expires_in: session.expires_in!
              }
              await this.callbacks.onSignIn?.(authSession)
              this.scheduleTokenRefresh(session.expires_in!)
            }
            break

          case 'SIGNED_OUT':
            if (this.refreshTimeout) {
              clearTimeout(this.refreshTimeout)
              this.refreshTimeout = null
            }
            await this.callbacks.onSignOut?.()
            break

          case 'TOKEN_REFRESHED':
            if (session?.user) {
              const profile = await this.fetchUserProfile(session.user.id)
              const authSession: AuthSession = {
                user: session.user,
                profile,
                access_token: session.access_token,
                refresh_token: session.refresh_token,
                expires_at: session.expires_at!,
                expires_in: session.expires_in!
              }
              await this.callbacks.onTokenRefresh?.(authSession)
              this.scheduleTokenRefresh(session.expires_in!)
            }
            break
        }
      } catch (error) {
        const authError = error instanceof AuthError ? error : new AuthError(String(error))
        await this.callbacks.onError?.(authError)
      }
    })
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
    }

    // Refresh 5 minutes before expiration
    const refreshTime = Math.max(expiresIn - 300, 60) * 1000

    this.refreshTimeout = setTimeout(async () => {
      try {
        await this.refreshSession()
      } catch (error) {
        const authError = error instanceof AuthError ? error : new AuthError(String(error))
        await this.callbacks.onError?.(authError)
      }
    }, refreshTime)
  }

  /**
   * Fetch user profile from database
   */
  private async fetchUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null // No profile found
        }
        throw new AuthError(`Failed to fetch user profile: ${error.message}`)
      }

      return data
    } catch (error) {
      // Don't throw on profile fetch errors, just return null
      console.warn('Failed to fetch user profile:', error)
      return null
    }
  }

  /**
   * Cleanup resources and listeners
   */
  destroy(): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout)
      this.refreshTimeout = null
    }
  }
}

/**
 * Create a new auth client instance
 */
export function createAuthClient(config: AuthConfig, callbacks?: AuthEventCallbacks): AuthClient {
  return new AuthClient(config, callbacks)
}

/**
 * Create an auth client from environment variables
 */
export function createAuthClientFromEnv(callbacks?: AuthEventCallbacks): AuthClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_ANON_KEY')
  }

  return new AuthClient({
    supabaseUrl,
    supabaseAnonKey,
    redirectUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }, callbacks)
}

/**
 * Utility function to check if an error is an authentication error
 */
export function isAuthError(error: any): error is AuthError {
  return error instanceof AuthError || 
         (error && typeof error === 'object' && error.name === 'AuthError')
}

/**
 * Utility function to extract auth error message
 */
export function getAuthErrorMessage(error: AuthError): string {
  // Map common Supabase auth errors to user-friendly messages
  const errorMessages: Record<string, string> = {
    'Invalid login credentials': 'Invalid email or password. Please try again.',
    'Email not confirmed': 'Please check your email and click the confirmation link.',
    'User not found': 'No account found with this email address.',
    'Password too short': 'Password must be at least 6 characters long.',
    'Email already registered': 'An account with this email already exists.',
    'Token has expired or is invalid': 'Your session has expired. Please sign in again.',
    'Network error': 'Network error. Please check your connection and try again.'
  }

  return errorMessages[error.message] || error.message || 'An unexpected error occurred.'
}