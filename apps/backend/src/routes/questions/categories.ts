import { Router, Request, Response, NextFunction } from 'express';
import { QuestionService } from '../../services/questions/QuestionService';
import { ValidationError, NotFoundError, ConflictError } from '../../middleware/errorHandler';
import type { CreateCategoryRequest } from '@vocilia/types/src/questions';

const router = Router();
const questionService = new QuestionService();

// GET /api/questions/categories
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

    if (!userBusinessId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'No business associated with user',
      });
    }

    // Get categories for the user's business
    const result = await questionService.listCategories(userBusinessId);

    res.status(200).json({
      data: result.categories,
      total: result.total,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: error.message,
      });
    }

    console.error('Error listing categories:', error);
    next(error);
  }
});

// POST /api/questions/categories
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
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

    if (!userBusinessId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'No business associated with user',
      });
    }

    const requestData: CreateCategoryRequest = req.body;

    // Validate required fields
    if (!requestData.name || requestData.name.trim().length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Category name is required',
        details: {
          name: 'Category name is required and cannot be empty',
        },
      });
    }

    // Validate name length
    if (requestData.name.length > 100) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Category name too long',
        details: {
          name: 'Category name must be 100 characters or less',
        },
      });
    }

    // Validate description length if provided
    if (requestData.description && requestData.description.length > 500) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Category description too long',
        details: {
          description: 'Category description must be 500 characters or less',
        },
      });
    }

    // Validate color format if provided
    if (requestData.color) {
      const colorRegex = /^#[0-9A-Fa-f]{6}$/;
      if (!colorRegex.test(requestData.color)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid color format',
          details: {
            color: 'Color must be a valid hex color code (e.g., #6366f1)',
          },
        });
      }
    }

    // Validate icon length if provided
    if (requestData.icon && requestData.icon.length > 50) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Icon identifier too long',
        details: {
          icon: 'Icon identifier must be 50 characters or less',
        },
      });
    }

    // Create the category
    const category = await questionService.createCategory(userBusinessId, requestData);

    res.status(201).json(category);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    if (error instanceof ConflictError) {
      return res.status(409).json({
        error: 'CONFLICT',
        message: error.message,
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: error.message,
      });
    }

    console.error('Error creating category:', error);
    next(error);
  }
});

// PUT /api/questions/categories/:categoryId
router.put('/:categoryId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userBusinessId = req.user?.business_id;
    const { categoryId } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    if (!userBusinessId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'No business associated with user',
      });
    }

    // Validate categoryId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(categoryId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid category ID format',
        details: {
          categoryId: 'Category ID must be a valid UUID',
        },
      });
    }

    const requestData: Partial<CreateCategoryRequest> = req.body;

    // Validate that at least one field is being updated
    const updateableFields = ['name', 'description', 'color', 'icon'];
    const fieldsToUpdate = Object.keys(requestData).filter(key => 
      updateableFields.includes(key) && requestData[key as keyof CreateCategoryRequest] !== undefined
    );

    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'No valid fields provided for update',
        details: {
          updateableFields: updateableFields.join(', '),
        },
      });
    }

    // Validate name if provided
    if (requestData.name !== undefined) {
      if (!requestData.name || requestData.name.trim().length === 0) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Category name cannot be empty',
          details: {
            name: 'Category name is required and cannot be empty',
          },
        });
      }

      if (requestData.name.length > 100) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Category name too long',
          details: {
            name: 'Category name must be 100 characters or less',
          },
        });
      }
    }

    // Validate description if provided
    if (requestData.description !== undefined && requestData.description && requestData.description.length > 500) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Category description too long',
        details: {
          description: 'Category description must be 500 characters or less',
        },
      });
    }

    // Validate color if provided
    if (requestData.color !== undefined && requestData.color) {
      const colorRegex = /^#[0-9A-Fa-f]{6}$/;
      if (!colorRegex.test(requestData.color)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid color format',
          details: {
            color: 'Color must be a valid hex color code (e.g., #6366f1)',
          },
        });
      }
    }

    // Validate icon if provided
    if (requestData.icon !== undefined && requestData.icon && requestData.icon.length > 50) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Icon identifier too long',
        details: {
          icon: 'Icon identifier must be 50 characters or less',
        },
      });
    }

    // Update the category
    const updatedCategory = await questionService.updateCategory(categoryId, requestData);

    res.status(200).json(updatedCategory);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    if (error instanceof ConflictError) {
      return res.status(409).json({
        error: 'CONFLICT',
        message: error.message,
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: error.message,
      });
    }

    console.error('Error updating category:', error);
    next(error);
  }
});

// DELETE /api/questions/categories/:categoryId
router.delete('/:categoryId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const userBusinessId = req.user?.business_id;
    const { categoryId } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'User not authenticated',
      });
    }

    if (!userBusinessId) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'No business associated with user',
      });
    }

    // Validate categoryId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(categoryId)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid category ID format',
        details: {
          categoryId: 'Category ID must be a valid UUID',
        },
      });
    }

    // Delete the category
    await questionService.deleteCategory(categoryId);

    res.status(204).send();
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    if (error instanceof ConflictError) {
      return res.status(409).json({
        error: 'CONFLICT',
        message: error.message,
      });
    }

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: error.message,
      });
    }

    console.error('Error deleting category:', error);
    next(error);
  }
});

export { router as questionsCategoriesRouter };