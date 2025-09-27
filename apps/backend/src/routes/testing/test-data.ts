import { Router } from 'express';
import { z } from 'zod';
import { TestDataService } from '../../services/testing/test-data-service.js';
import { authenticateAdmin } from '../../middleware/admin-auth.js';

const router = Router();
const testDataService = new TestDataService();

// Validation schemas
const createDatasetSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(['users', 'stores', 'transactions', 'feedback', 'admin']),
  schema: z.object({}), // Allow any object structure
  generatorConfig: z.object({
    locale: z.string().min(2).max(10).default('sv-SE'),
    seed: z.number().optional(),
    rules: z.object({}).optional()
  }),
  sampleSize: z.number().min(1).max(10000),
  refreshStrategy: z.enum(['static', 'per-run', 'per-test']),
  constraints: z.object({}).optional(),
  tags: z.array(z.string()).optional().default([]),
  enabled: z.boolean().optional().default(true)
});

const querySchema = z.object({
  category: z.enum(['users', 'stores', 'transactions', 'feedback', 'admin']).optional(),
  refreshStrategy: z.enum(['static', 'per-run', 'per-test']).optional(),
  enabled: z.boolean().optional(),
  tags: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20)
});

// GET /api/test/data/datasets - List test datasets
router.get('/datasets', authenticateAdmin, async (req, res) => {
  try {
    const query = querySchema.parse(req.query);
    
    const filters = {
      category: query.category,
      refreshStrategy: query.refreshStrategy,
      enabled: query.enabled,
      tags: query.tags ? query.tags.split(',') : undefined
    };

    const { datasets, total } = await testDataService.getDatasets(filters, {
      page: query.page,
      limit: query.limit
    });

    res.json({
      data: datasets,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    console.error('Error fetching test datasets:', error);
    res.status(500).json({ error: 'Failed to fetch test datasets' });
  }
});

// POST /api/test/data/datasets - Create test dataset
router.post('/datasets', authenticateAdmin, async (req, res) => {
  try {
    const datasetData = createDatasetSchema.parse(req.body);
    
    const dataset = await testDataService.createDataset(datasetData);
    
    // Generate initial data if needed
    if (datasetData.refreshStrategy === 'static') {
      await testDataService.generateDataRecords(dataset.id);
    }
    
    res.status(201).json({
      data: dataset,
      message: 'Test dataset created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: error.errors 
      });
    }
    
    console.error('Error creating test dataset:', error);
    res.status(500).json({ error: 'Failed to create test dataset' });
  }
});

export default router;