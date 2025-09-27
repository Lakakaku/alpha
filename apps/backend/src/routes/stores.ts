import { Router, Request, Response, NextFunction } from 'express';
import { database } from '@vocilia/database';

const router = Router();

interface CreateStoreRequest {
  name: string;
  address?: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
  store_code?: string;
}

interface UpdateStoreRequest {
  name?: string;
  address?: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
  store_code?: string;
  active?: boolean;
}

interface Store {
  id: string;
  business_id: string;
  name: string;
  address: {
    street?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  } | null;
  store_code: string | null;
  qr_code_data: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// GET /businesses/:businessId/stores
router.get('/businesses/:businessId/stores', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userBusinessId = req.user?.business_id;
    const { businessId } = req.params;
    const active = req.query.active;

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

    // Verify business exists
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return res.status(404).json({
        error: 'BUSINESS_NOT_FOUND',
        message: 'Business not found',
      });
    }

    let query = supabase
      .from('stores')
      .select('*')
      .eq('business_id', businessId);

    // Apply active filter if provided
    if (active !== undefined) {
      const isActive = active === 'true';
      query = query.eq('active', isActive);
    }

    query = query.order('created_at', { ascending: false });

    const { data: stores, error } = await query;

    if (error) {
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Failed to fetch stores',
      });
    }

    res.status(200).json({
      data: stores || [],
    });
  } catch (error) {
    next(error);
  }
});

// POST /businesses/:businessId/stores
router.post('/businesses/:businessId/stores', async (req: Request, res: Response, next: NextFunction) => {
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

    const { name, address, store_code }: CreateStoreRequest = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Store name is required',
        details: {
          name: 'Name is required',
        },
      });
    }

    // Validate name length
    if (name.length < 1 || name.length > 100) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Store name must be between 1 and 100 characters',
      });
    }

    const supabase = database.createClient();

    // Verify business exists
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .single();

    if (businessError || !business) {
      return res.status(404).json({
        error: 'BUSINESS_NOT_FOUND',
        message: 'Business not found',
      });
    }

    // Generate QR code data for customer entry
    const storeId = crypto.randomUUID();
    const qrCodeData = `https://customer.vocilia.se/entry/store/${storeId}`;

    const { data: store, error } = await supabase
      .from('stores')
      .insert({
        id: storeId,
        business_id: businessId,
        name,
        address: address || null,
        store_code: store_code || null,
        qr_code_data: qrCodeData,
        active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({
          error: 'DUPLICATE_STORE',
          message: 'A store with this information already exists',
        });
      }
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Failed to create store',
      });
    }

    res.status(201).json(store);
  } catch (error) {
    next(error);
  }
});

// GET /stores/:storeId
router.get('/:storeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userBusinessId = req.user?.business_id;
    const { storeId } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    const supabase = database.createClient();

    const { data: store, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'STORE_NOT_FOUND',
          message: 'Store not found',
        });
      }
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Failed to fetch store',
      });
    }

    // Check access permissions
    if (userRole === 'business_account' && userBusinessId !== store.business_id) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this store',
      });
    }

    res.status(200).json(store);
  } catch (error) {
    next(error);
  }
});

// PATCH /stores/:storeId
router.patch('/:storeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userBusinessId = req.user?.business_id;
    const { storeId } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    const { name, address, store_code, active }: UpdateStoreRequest = req.body;

    // Validate inputs
    if (name !== undefined && (name.length < 1 || name.length > 100)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Store name must be between 1 and 100 characters',
      });
    }

    const supabase = database.createClient();

    // First, get the store to check permissions
    const { data: existingStore, error: fetchError } = await supabase
      .from('stores')
      .select('business_id')
      .eq('id', storeId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          error: 'STORE_NOT_FOUND',
          message: 'Store not found',
        });
      }
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Failed to fetch store',
      });
    }

    // Check access permissions
    if (userRole === 'business_account' && userBusinessId !== existingStore.business_id) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied to this store',
      });
    }

    // Build update object
    const updateData: Partial<UpdateStoreRequest & { updated_at: string }> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (store_code !== undefined) updateData.store_code = store_code;
    if (active !== undefined) updateData.active = active;

    const { data: store, error } = await supabase
      .from('stores')
      .update(updateData)
      .eq('id', storeId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Failed to update store',
      });
    }

    res.status(200).json(store);
  } catch (error) {
    next(error);
  }
});

export { router as storeRoutes };