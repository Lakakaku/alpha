import { Router, Request, Response, NextFunction } from 'express';
import { database } from '@vocilia/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

interface LoginRequest {
  email: string;
  password: string;
}

interface RefreshRequest {
  refresh_token: string;
}

interface UpdateProfileRequest {
  full_name?: string;
  avatar_url?: string;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: UserProfile;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'business_account' | 'admin_account';
  business_id: string | null;
  created_at: string;
  updated_at: string;
}

// POST /auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password }: LoginRequest = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required',
        details: {
          email: !email ? 'Email is required' : undefined,
          password: !password ? 'Password is required' : undefined,
        },
      });
    }

    const supabase = database.createClient();

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    if (!data.user || !data.session) {
      return res.status(401).json({
        error: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed',
      });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({
        error: 'PROFILE_ERROR',
        message: 'Failed to fetch user profile',
      });
    }

    const authResponse: AuthResponse = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      token_type: 'bearer',
      expires_in: data.session.expires_in || 3600,
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        business_id: profile.business_id,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    };

    res.status(200).json(authResponse);
  } catch (error) {
    next(error);
  }
});

// POST /auth/logout
router.post('/logout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = database.createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(500).json({
        error: 'LOGOUT_ERROR',
        message: 'Failed to logout',
      });
    }

    res.status(200).json({
      message: 'Successfully logged out',
    });
  } catch (error) {
    next(error);
  }
});

// POST /auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token }: RefreshRequest = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Refresh token is required',
      });
    }

    const supabase = database.createClient();

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error) {
      return res.status(401).json({
        error: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
      });
    }

    if (!data.user || !data.session) {
      return res.status(401).json({
        error: 'REFRESH_FAILED',
        message: 'Failed to refresh session',
      });
    }

    // Get updated user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({
        error: 'PROFILE_ERROR',
        message: 'Failed to fetch user profile',
      });
    }

    const authResponse: AuthResponse = {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      token_type: 'bearer',
      expires_in: data.session.expires_in || 3600,
      user: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        business_id: profile.business_id,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
    };

    res.status(200).json(authResponse);
  } catch (error) {
    next(error);
  }
});

// GET /auth/profile
router.get('/profile', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    const supabase = database.createClient();

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return res.status(500).json({
        error: 'PROFILE_ERROR',
        message: 'Failed to fetch user profile',
      });
    }

    if (!profile) {
      return res.status(404).json({
        error: 'PROFILE_NOT_FOUND',
        message: 'User profile not found',
      });
    }

    const userProfile: UserProfile = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      business_id: profile.business_id,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };

    res.status(200).json(userProfile);
  } catch (error) {
    next(error);
  }
});

// PATCH /auth/profile
router.patch('/profile', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const { full_name, avatar_url }: UpdateProfileRequest = req.body;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    // Validate input
    if (full_name !== undefined && (typeof full_name !== 'string' || full_name.length > 100)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid full_name',
        details: {
          full_name: 'Must be a string with maximum 100 characters',
        },
      });
    }

    if (avatar_url !== undefined && (typeof avatar_url !== 'string' || avatar_url.length > 500)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid avatar_url',
        details: {
          avatar_url: 'Must be a valid URL string',
        },
      });
    }

    const supabase = database.createClient();

    // Update profile
    const updateData: Partial<UpdateProfileRequest> = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'UPDATE_ERROR',
        message: 'Failed to update profile',
      });
    }

    const userProfile: UserProfile = {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      business_id: profile.business_id,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };

    res.status(200).json(userProfile);
  } catch (error) {
    next(error);
  }
});

// GET /auth/permissions
router.get('/permissions', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    const supabase = database.createClient();

    // Get user profile with role and business_id
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, business_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({
        error: 'PROFILE_ERROR',
        message: 'Failed to fetch user profile',
      });
    }

    // Get user permissions
    const { data: userPermissions, error: permissionsError } = await supabase
      .from('user_permissions')
      .select(`
        permission:permissions(name)
      `)
      .eq('user_id', userId);

    if (permissionsError) {
      return res.status(500).json({
        error: 'PERMISSIONS_ERROR',
        message: 'Failed to fetch user permissions',
      });
    }

    // Extract permission names
    const permissions = userPermissions?.map(up => up.permission?.name).filter(Boolean) || [];

    // Add default permissions based on role
    if (profile.role === 'admin_account') {
      permissions.push('admin.read', 'admin.write', 'business.read', 'business.write');
    } else if (profile.role === 'business_account') {
      permissions.push('business.read', 'feedback.read', 'customers.read');
    }

    res.status(200).json({
      role: profile.role,
      permissions: [...new Set(permissions)], // Remove duplicates
      business_id: profile.business_id,
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRoutes };