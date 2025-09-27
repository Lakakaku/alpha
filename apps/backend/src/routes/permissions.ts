import { Router, Request, Response, NextFunction } from 'express';
import { database } from '@vocilia/database';

const router = Router();

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  created_at: string;
}

// GET /permissions
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    const category = req.query.category as string;

    const supabase = database.createClient();

    let query = supabase
      .from('permissions')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    // Apply category filter if provided
    if (category) {
      const validCategories = ['business', 'customer', 'admin', 'feedback'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid category',
          details: {
            category: `Category must be one of: ${validCategories.join(', ')}`,
          },
        });
      }
      query = query.eq('category', category);
    }

    const { data: permissions, error } = await query;

    if (error) {
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: 'Failed to fetch permissions',
      });
    }

    res.status(200).json({
      data: permissions || [],
    });
  } catch (error) {
    next(error);
  }
});

export { router as permissionRoutes };