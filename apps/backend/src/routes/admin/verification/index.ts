import { Router } from 'express';
import cyclesRouter from './cycles';
import prepareRouter from './prepare';
import databasesRouter from './databases';
import invoicesRouter from './invoices';
import paymentRouter from './payment';

const router = Router();

// Mount sub-routers
router.use('/cycles', cyclesRouter);
router.use('/cycles', prepareRouter); // For /cycles/:cycleId/prepare
router.use('/cycles', databasesRouter); // For /cycles/:cycleId/databases
router.use('/cycles', invoicesRouter); // For /cycles/:cycleId/invoices
router.use('/invoices', paymentRouter); // For /invoices/:invoiceId/payment

export default router;