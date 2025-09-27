import { Router, Request, Response, NextFunction } from 'express';
import { database } from '@vocilia/database';

const router = Router();

interface CreateBusinessRequest {
  name: string;
  organization_number?: string;
  contact_email: string;
  phone_number?: string;
  address?: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
}

interface UpdateBusinessRequest {
  name?: string;
  contact_email?: string;
  phone_number?: string;
  address?: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
  subscription_status?: 'active' | 'inactive' | 'suspended';
}

interface Business {
  id: string;
  name: string;
  organization_number: string | null;
  contact_email: string | null;
  phone_number: string | null;
  address: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  } | null;
  subscription_status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// GET /businesses
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userBusinessId = req.user?.business_id;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const search = req.query.search as string;

    const supabase = database.createClient();

    let query = supabase
      .from('businesses')
      .select('*', { count: 'exact' });

    // Apply access control
    if (userRole === 'business_account') {
      // Business users can only see their own business
      if (!userBusinessId) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'No business associated with this account',
        });
      }
      query = query.eq('id', userBusinessId);
    }
    // Admin users can see all businesses (no additional filter needed)

    // Apply search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Apply pagination
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data: businesses, error, count } = await query;

    if (error) {
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Failed to fetch businesses',
      });
    }

    const pagination: Pagination = {
      total: count || 0,
      limit,
      offset,
      has_more: (count || 0) > offset + limit,
    };

    res.status(200).json({
      data: businesses || [],
      pagination,
    });
  } catch (error) {
    next(error);
  }
});

// POST /businesses
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    // Only admin users can create businesses
    if (userRole !== 'admin_account') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only admin users can create businesses',
      });
    }

    const {
      name,
      organization_number,
      contact_email,
      phone_number,
      address,
    }: CreateBusinessRequest = req.body;

    // Validate required fields
    if (!name || !contact_email) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Name and contact_email are required',
        details: {
          name: !name ? 'Name is required' : undefined,
          contact_email: !contact_email ? 'Contact email is required' : undefined,
        },
      });
    }

    // Validate name length
    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Name must be between 2 and 100 characters',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_email)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid email format',
      });
    }

    const supabase = database.createClient();

    const { data: business, error } = await supabase
      .from('businesses')
      .insert({
        name,
        organization_number: organization_number || null,
        contact_email,
        phone_number: phone_number || null,
        address: address || null,
        subscription_status: 'active',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({
          error: 'DUPLICATE_BUSINESS',
          message: 'A business with this information already exists',
        });
      }
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Failed to create business',
      });
    }

    res.status(201).json(business);
  } catch (error) {
    next(error);
  }
});

// GET /businesses/:businessId
router.get('/:businessId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userBusinessId = req.user?.business_id;
    const { businessId } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    // Check access permissions
    if (userRole === 'business_account' && userBusinessId !== businessId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this business',
      });
    }

    const supabase = database.createClient();

    const { data: business, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'BUSINESS_NOT_FOUND',
          message: 'Business not found',
        });
      }
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Failed to fetch business',
      });
    }

    res.status(200).json(business);
  } catch (error) {
    next(error);
  }
});

// PATCH /businesses/:businessId
router.patch('/:businessId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userBusinessId = req.user?.business_id;
    const { businessId } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    // Check access permissions
    if (userRole === 'business_account' && userBusinessId !== businessId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this business',
      });
    }

    const {
      name,
      contact_email,
      phone_number,
      address,
      subscription_status,
    }: UpdateBusinessRequest = req.body;

    // Validate inputs
    if (name !== undefined && (name.length < 2 || name.length > 100)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Name must be between 2 and 100 characters',
      });
    }

    if (contact_email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact_email)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid email format',
        });
      }
    }

    // Only admin users can change subscription status
    if (subscription_status !== undefined && userRole !== 'admin_account') {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Only admin users can change subscription status',
      });
    }

    const supabase = database.createClient();

    // Build update object
    const updateData: Partial<UpdateBusinessRequest & { updated_at: string }> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (contact_email !== undefined) updateData.contact_email = contact_email;
    if (phone_number !== undefined) updateData.phone_number = phone_number;
    if (address !== undefined) updateData.address = address;
    if (subscription_status !== undefined) updateData.subscription_status = subscription_status;

    const { data: business, error } = await supabase
      .from('businesses')
      .update(updateData)
      .eq('id', businessId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'BUSINESS_NOT_FOUND',
          message: 'Business not found',
        });
      }
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Failed to update business',
      });
    }

    res.status(200).json(business);
  } catch (error) {
    next(error);
  }
});

export { router as businessRoutes };