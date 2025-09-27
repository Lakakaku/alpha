import { Router } from 'express';
import { handleFortyElksWebhook, handleTwilioWebhook, handleVoiceBridge } from '../calls/webhooks';

const router = Router();

// 46elks webhook endpoints
router.post('/fortyelks/voice-start', handleFortyElksWebhook);
router.post('/fortyelks/status', handleFortyElksWebhook);
router.post('/fortyelks/voice-bridge', handleVoiceBridge);

// Twilio webhook endpoints  
router.post('/twilio/voice-start', handleTwilioWebhook);
router.post('/twilio/status', handleTwilioWebhook);

export default router;