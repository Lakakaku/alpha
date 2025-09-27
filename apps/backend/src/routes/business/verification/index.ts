import { Router } from 'express';
import databasesRouter from './databases';
import downloadRouter from './download';
import submitRouter from './submit';
import recordsRouter from './records';

const router = Router();

// Mount sub-routers
router.use('/databases', databasesRouter);
router.use('/databases', downloadRouter); // For /databases/:id/download/:format
router.use('/databases', submitRouter); // For /databases/:id/submit
router.use('/databases', recordsRouter); // For /databases/:id/records

export default router;