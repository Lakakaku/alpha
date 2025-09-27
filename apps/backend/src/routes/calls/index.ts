import { Router } from 'express';
import { initiateCall } from './initiate';
import { getCallStatus } from './status';
import { completeCall } from './complete';
import { 
  handleFortyElksWebhook, 
  handleTwilioWebhook, 
  handleVoiceBridge,
  validateWebhookSignature 
} from './webhooks';

const router = Router();

// Call management endpoints
router.post('/initiate', initiateCall);
router.get('/:sessionId/status', getCallStatus);
router.post('/:sessionId/complete', completeCall);

// Webhook endpoints with signature validation
router.use('/webhooks', validateWebhookSignature);

// 46elks webhooks
router.post('/webhooks/fortyelks/voice-start', handleFortyElksWebhook);
router.post('/webhooks/fortyelks/status', handleFortyElksWebhook);
router.post('/webhooks/fortyelks/voice-bridge', handleVoiceBridge);

// Twilio webhooks
router.post('/webhooks/twilio/voice-start', handleTwilioWebhook);
router.post('/webhooks/twilio/status', handleTwilioWebhook);

export default router;