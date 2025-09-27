import { Router, Request, Response } from 'express';
import multer from 'multer';
import { StoreMonitoringService } from '../../services/admin/store-monitoring';
import { StoreModel } from '@vocilia/database/store/store';
import { adminAuth } from '../../middleware/admin-auth';
import { rateLimiter } from '../../middleware/rateLimiter';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

interface AdminRequest extends Request {
  admin?: {
    id: string;
    username: string;
    fullName: string;
    email: string;
  };
}

/**
 * GET /admin/stores
 * Get all stores with monitoring data
 */
router.get('/', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const onlineStatus = req.query.online_status === 'true' ? true : 
                        req.query.online_status === 'false' ? false : undefined;
    const syncStatus = req.query.sync_status as 'pending' | 'success' | 'failed';
    const monitoringEnabled = req.query.monitoring_enabled === 'true' ? true : 
                             req.query.monitoring_enabled === 'false' ? false : undefined;

    const { stores, total } = await StoreMonitoringService.getAllStoresMonitoring(
      page,
      limit,
      {
        search,
        onlineStatus,
        syncStatus,
        monitoringEnabled
      }
    );

    res.json({
      success: true,
      stores,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrevious: page > 1
      }
    });
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /admin/stores/:id
 * Get specific store with detailed monitoring data
 */
router.get('/:id', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const storeData = await StoreMonitoringService.getStoreMonitoringData(id);
    if (!storeData) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Get metrics for last 7 days
    const endDate = new Date().toISOString();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const [
      syncMetrics,
      errorMetrics,
      performanceMetrics,
      availabilityMetrics
    ] = await Promise.all([
      StoreMonitoringService.getStoreMetrics(id, startDate.toISOString(), endDate, 'sync'),
      StoreMonitoringService.getStoreMetrics(id, startDate.toISOString(), endDate, 'error'),
      StoreMonitoringService.getStoreMetrics(id, startDate.toISOString(), endDate, 'performance'),
      StoreMonitoringService.getStoreMetrics(id, startDate.toISOString(), endDate, 'availability')
    ]);

    res.json({
      success: true,
      store: storeData,
      metrics: {
        sync: syncMetrics,
        error: errorMetrics,
        performance: performanceMetrics,
        availability: availabilityMetrics
      }
    });
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /admin/stores
 * Create new store
 */
router.post('/', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const storeData = req.body;

    // Validate required fields
    const requiredFields = ['name', 'business_email', 'phone_number', 'physical_address', 'business_registration_number'];
    for (const field of requiredFields) {
      if (!storeData[field]) {
        return res.status(400).json({
          success: false,
          error: `Field '${field}' is required`
        });
      }
    }

    // Validate store data
    const validation = StoreModel.validateStoreData(storeData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    // Create store
    const store = await StoreModel.create({
      ...storeData,
      qr_code_data: `store_${Date.now()}_${Math.random().toString(36).substring(2)}`
    });

    if (!store) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create store'
      });
    }

    // Log audit trail
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    await StoreMonitoringService.updateStoreStatus(
      store.id,
      {},
      req.admin.id,
      ipAddress,
      userAgent
    );

    res.status(201).json({
      success: true,
      store: {
        id: store.id,
        name: store.name,
        businessEmail: store.business_email,
        phoneNumber: store.phone_number,
        physicalAddress: store.physical_address,
        businessRegistrationNumber: store.business_registration_number,
        qrCodeData: store.qr_code_data,
        onlineStatus: store.online_status,
        syncStatus: store.sync_status,
        createdAt: store.created_at
      }
    });
  } catch (error) {
    console.error('Create store error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /admin/stores/:id
 * Update store information
 */
router.put('/:id', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { id } = req.params;
    const updates = req.body;

    // Validate updates
    const validation = StoreModel.validateStoreData(updates);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    const success = await StoreMonitoringService.updateStoreStatus(
      id,
      updates,
      req.admin.id,
      ipAddress,
      userAgent
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Store not found or update failed'
      });
    }

    // Get updated store data
    const updatedStore = await StoreMonitoringService.getStoreMonitoringData(id);

    res.json({
      success: true,
      store: updatedStore
    });
  } catch (error) {
    console.error('Update store error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /admin/stores/:id
 * Delete store
 */
router.delete('/:id', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { id } = req.params;

    const success = await StoreModel.delete(id);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Store not found or deletion failed'
      });
    }

    res.json({
      success: true,
      message: 'Store deleted successfully'
    });
  } catch (error) {
    console.error('Delete store error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /admin/stores/:id/upload
 * Upload weekly verification database
 */
router.post('/:id/upload', adminAuth, upload.single('database'), async (req: AdminRequest, res: Response) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { id: storeId } = req.params;
    const { week_start_date, notes } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    if (!week_start_date) {
      return res.status(400).json({
        success: false,
        error: 'Week start date is required'
      });
    }

    // Validate date format
    const weekStart = new Date(week_start_date);
    if (isNaN(weekStart.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid week start date format'
      });
    }

    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    const result = await StoreMonitoringService.processDatabaseUpload({
      storeId,
      adminId: req.admin.id,
      weekStartDate: week_start_date,
      fileName: req.file.originalname,
      fileContent: req.file.buffer,
      ipAddress,
      userAgent
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      uploadId: result.uploadId,
      recordsProcessed: result.recordsProcessed,
      message: `Successfully processed ${result.recordsProcessed} records`,
      notes
    });
  } catch (error) {
    console.error('Database upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /admin/stores/:id/health-check
 * Perform health check on store
 */
router.post('/:id/health-check', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;

    const healthCheck = await StoreMonitoringService.performHealthCheck(id);

    res.json({
      success: true,
      healthCheck
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /admin/stores/:id/monitoring
 * Toggle store monitoring
 */
router.put('/:id/monitoring', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const { id } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Enabled field must be boolean'
      });
    }

    const success = await StoreModel.toggleMonitoring(id, enabled);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Store not found or update failed'
      });
    }

    res.json({
      success: true,
      message: `Monitoring ${enabled ? 'enabled' : 'disabled'} for store`
    });
  } catch (error) {
    console.error('Toggle monitoring error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /admin/stores/:id/metrics
 * Get store metrics for date range
 */
router.get('/:id/metrics', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const { id } = req.params;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    const metricType = req.query.metric_type as 'sync' | 'error' | 'performance' | 'availability';

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    const metrics = await StoreMonitoringService.getStoreMetrics(
      id,
      startDate,
      endDate,
      metricType
    );

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /admin/stores/search
 * Search stores
 */
router.get('/search', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    const stores = await StoreModel.search(query.trim(), limit);

    res.json({
      success: true,
      stores: stores.map(store => ({
        id: store.id,
        name: store.name,
        businessEmail: store.business_email,
        physicalAddress: store.physical_address,
        onlineStatus: store.online_status,
        syncStatus: store.sync_status
      }))
    });
  } catch (error) {
    console.error('Search stores error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /admin/stores/statistics
 * Get store statistics
 */
router.get('/statistics', adminAuth, async (req: AdminRequest, res: Response) => {
  try {
    const statistics = await StoreModel.getStatistics();

    res.json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;