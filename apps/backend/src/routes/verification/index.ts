import express from 'express';
import { verificationSubmitRouter } from './submit';
import { verificationSessionRouter } from './session';

const router = express.Router();

// Mount verification routes
router.use('/', verificationSubmitRouter);
router.use('/', verificationSessionRouter);

export { router as verificationRouter };