import { useState, useEffect, useCallback, useContext, createContext, ReactNode } from 'react'
import type { AuthContext, AuthUser, UserProfile, LoginRequest, ProfileUpdateRequest } from '@vocilia/types'
import { AuthClient, createAuthClientFromEnv, isAuthError, getAuthErrorMessage, type AuthSession } from './clients.js'

// Auth Context
const AuthProviderContext = createContext<AuthContext | null>(null)

export interface AuthProviderProps {
  children: ReactNode
  authClient?: AuthClient
  enableDevMode?: boolean
}

export interface AuthProviderState {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
}

/**
 * Auth Provider component that manages authentication state
 */
export function AuthProvider({ children, authClient, enableDevMode = false }: AuthProviderProps) {
  const [client] = useState(() => authClient || createAuthClientFromEnv())
  const [state, setState] = useState<AuthProviderState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null
  })

  // Convert AuthSession to AuthUser
  const createAuthUser = useCallback((session: AuthSession): AuthUser | null => {
    if (!session.profile) return null

    return {
      id: session.user.id,
      email: session.profile.email,
      role: session.profile.role,
      business_id: session.profile.business_id,
      permissions: [] // Will be populated by permission utilities
    }
  }, [])

  // Handle sign in
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await client.signIn({ email, password })
      
      // The onSignIn callback will update the state
      if (enableDevMode) {
        console.log('Login successful:', response.user.email)
      }
    } catch (error) {
      const errorMessage = isAuthError(error) 
        ? getAuthErrorMessage(error)
        : 'Login failed. Please try again.'
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))

      if (enableDevMode) {
        console.error('Login failed:', error)
      }

      throw new Error(errorMessage)
    }
  }, [client, enableDevMode])

  // Handle sign out
  const logout = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      await client.signOut()
      
      if (enableDevMode) {
        console.log('Logout successful')
      }
    } catch (error) {
      const errorMessage = isAuthError(error)
        ? getAuthErrorMessage(error)
        : 'Logout failed. Please try again.'

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))

      if (enableDevMode) {
        console.error('Logout failed:', error)
      }

      throw new Error(errorMessage)
    }
  }, [client, enableDevMode])

  // Handle token refresh
  const refreshToken = useCallback(async (): Promise<void> => {
    try {
      await client.refreshSession()
      
      if (enableDevMode) {
        console.log('Token refresh successful')
      }
    } catch (error) {
      const errorMessage = isAuthError(error)
        ? getAuthErrorMessage(error)
        : 'Token refresh failed.'

      setState(prev => ({
        ...prev,
        error: errorMessage
      }))

      if (enableDevMode) {
        console.error('Token refresh failed:', error)
      }

      throw new Error(errorMessage)
    }
  }, [client, enableDevMode])

  // Handle profile update
  const updateProfile = useCallback(async (updates: ProfileUpdateRequest): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const updatedProfile = await client.updateProfile(updates)
      
      // Update the current user state
      setState(prev => ({
        ...prev,
        user: prev.user ? {
          ...prev.user,
          // Update relevant fields from the profile
        } : null,
        isLoading: false
      }))

      if (enableDevMode) {
        console.log('Profile update successful:', updatedProfile)
      }
    } catch (error) {
      const errorMessage = isAuthError(error)
        ? getAuthErrorMessage(error)
        : 'Profile update failed. Please try again.'

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }))

      if (enableDevMode) {
        console.error('Profile update failed:', error)
      }

      throw new Error(errorMessage)
    }
  }, [client, enableDevMode])

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        const session = await client.getSession()
        
        if (!mounted) return

        if (session) {
          const authUser = createAuthUser(session)
          setState({
            user: authUser,
            isLoading: false,
            isAuthenticated: authUser !== null,
            error: null
          })
        } else {
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
            error: null
          })
        }

        if (enableDevMode) {
          console.log('Auth initialized:', session ? 'authenticated' : 'not authenticated')
        }
      } catch (error) {
        if (!mounted) return

        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: 'Failed to initialize authentication'
        })

        if (enableDevMode) {
          console.error('Auth initialization failed:', error)
        }
      }
    }

    initializeAuth()

    return () => {
      mounted = false
    }
  }, [client, createAuthUser, enableDevMode])

  // Set up auth event callbacks
  useEffect(() => {
    const callbacks = {
      onSignIn: async (session: AuthSession) => {
        const authUser = createAuthUser(session)
        setState({
          user: authUser,
          isLoading: false,
          isAuthenticated: authUser !== null,
          error: null
        })

        if (enableDevMode) {
          console.log('Auth state: signed in', authUser?.email)
        }
      },

      onSignOut: async () => {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: null
        })

        if (enableDevMode) {
          console.log('Auth state: signed out')
        }
      },

      onTokenRefresh: async (session: AuthSession) => {
        const authUser = createAuthUser(session)
        setState(prev => ({
          ...prev,
          user: authUser,
          isAuthenticated: authUser !== null,
          error: null
        }))

        if (enableDevMode) {
          console.log('Auth state: token refreshed')
        }
      },

      onError: async (error: any) => {
        const errorMessage = isAuthError(error)
          ? getAuthErrorMessage(error)
          : 'Authentication error occurred'

        setState(prev => ({
          ...prev,
          error: errorMessage
        }))

        if (enableDevMode) {
          console.error('Auth error:', error)
        }
      }
    }

    // Note: We can't directly update the callbacks on an existing client
    // This would require recreating the client or adding a method to update callbacks
    // For now, the callbacks are set during client creation

    return () => {
      // Cleanup if needed
    }
  }, [createAuthUser, enableDevMode])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      client.destroy()
    }
  }, [client])

  const contextValue: AuthContext = {
    user: state.user,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    login,
    logout,
    refreshToken,
    updateProfile
  }

  return (
    <AuthProviderContext.Provider value={contextValue}>
      {children}
    </AuthProviderContext.Provider>
  )
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContext {
  const context = useContext(AuthProviderContext)
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  
  return context
}

/**
 * Hook for authentication state only (lighter alternative to useAuth)
 */
export function useAuthState() {
  const { user, isLoading, isAuthenticated } = useAuth()
  
  return {
    user,
    isLoading,
    isAuthenticated
  }
}

/**
 * Hook for authentication actions only
 */
export function useAuthActions() {
  const { login, logout, refreshToken, updateProfile } = useAuth()
  
  return {
    login,
    logout,
    refreshToken,
    updateProfile
  }
}

/**
 * Hook to get the current user
 */
export function useUser(): AuthUser | null {
  const { user } = useAuth()
  return user
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth()
  return isAuthenticated
}

/**
 * Hook for conditional rendering based on authentication status
 */
export function useAuthGuard() {
  const { isAuthenticated, isLoading } = useAuth()
  
  return {
    isAuthenticated,
    isLoading,
    canRender: !isLoading && isAuthenticated,
    mustAuthenticate: !isLoading && !isAuthenticated
  }
}

/**
 * Hook for handling authentication form state
 */
export function useAuthForm() {
  const [formState, setFormState] = useState({
    email: '',
    password: '',
    isSubmitting: false,
    error: null as string | null
  })

  const { login } = useAuth()

  const updateField = useCallback((field: 'email' | 'password', value: string) => {
    setFormState(prev => ({
      ...prev,
      [field]: value,
      error: null // Clear error when user types
    }))
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formState.email || !formState.password) {
      setFormState(prev => ({
        ...prev,
        error: 'Please fill in all fields'
      }))
      return
    }

    setFormState(prev => ({
      ...prev,
      isSubmitting: true,
      error: null
    }))

    try {
      await login(formState.email, formState.password)
      // Success - the auth context will handle state updates
    } catch (error) {
      setFormState(prev => ({
        ...prev,
        isSubmitting: false,
        error: error instanceof Error ? error.message : 'Login failed'
      }))
    }
  }, [formState.email, formState.password, login])

  const clearForm = useCallback(() => {
    setFormState({
      email: '',
      password: '',
      isSubmitting: false,
      error: null
    })
  }, [])

  return {
    formState,
    updateField,
    handleSubmit,
    clearForm
  }
}

/**
 * Hook for managing session persistence
 */
export function useSessionPersistence() {
  const { user, isAuthenticated } = useAuth()
  const [hasCheckedSession, setHasCheckedSession] = useState(false)

  useEffect(() => {
    // Mark as checked once we've attempted to load the session
    if (!hasCheckedSession) {
      const timer = setTimeout(() => {
        setHasCheckedSession(true)
      }, 1000) // Give auth provider time to initialize

      return () => clearTimeout(timer)
    }
  }, [hasCheckedSession])

  return {
    hasCheckedSession,
    isRestoring: !hasCheckedSession,
    hasPersistedSession: hasCheckedSession && isAuthenticated,
    user
  }
}

/**
 * Hook for auto-logout on tab visibility change (security feature)
 */
export function useAutoLogout(enabled: boolean = true, timeoutMinutes: number = 30) {
  const { logout, isAuthenticated } = useAuth()

  useEffect(() => {
    if (!enabled || !isAuthenticated) return

    let timeoutId: NodeJS.Timeout

    const resetTimeout = () => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        logout()
      }, timeoutMinutes * 60 * 1000)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, start shorter timeout
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          logout()
        }, 5 * 60 * 1000) // 5 minute timeout when hidden
      } else {
        // Page is visible, reset to normal timeout
        resetTimeout()
      }
    }

    const handleActivity = () => {
      resetTimeout()
    }

    // Set initial timeout
    resetTimeout()

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Listen for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      events.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }, [enabled, isAuthenticated, logout, timeoutMinutes])
}