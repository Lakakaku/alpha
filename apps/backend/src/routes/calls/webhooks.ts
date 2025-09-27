import { Request, Response } from 'express';
import { FortyElksService } from '../../services/telephony/FortyElksService';
import { TwilioService } from '../../services/telephony/TwilioService';
import { CallEvent } from '../../models/CallEvent';
import { CallSession } from '../../models/CallSession';

export const handleFortyElksWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // 46elks sends data as form-encoded
    const webhookData = req.body;

    console.log('Received 46elks webhook:', webhookData);

    // Create webhook payload in our standard format
    const payload = {
      providerId: 'fortyelks',
      event: req.path.includes('voice-start') ? 'voice_start' : 'status_update',
      data: webhookData,
      timestamp: new Date().toISOString()
    };

    // Handle the webhook using FortyElksService
    const service = new FortyElksService();
    await service.handleWebhook(payload);

    // Log the webhook reception
    if (webhookData.callid) {
      await CallEvent.create({
        sessionId: webhookData.callid, // Will be mapped to actual session ID in service
        eventType: 'webhook_received',
        providerId: 'fortyelks',
        eventData: {
          webhook_type: req.path,
          raw_data: webhookData,
          endpoint: req.originalUrl
        }
      });
    }

    // Respond to 46elks
    if (req.path.includes('voice-start')) {
      // Return TwiML-like response for voice start
      res.set('Content-Type', 'application/json');
      res.json({
        instruction: 'connect',
        next: `${process.env.FORTYELKS_WEBHOOK_URL}/voice-bridge`
      });
    } else {
      // Status update - just acknowledge
      res.status(200).send('OK');
    }

  } catch (error) {
    console.error('46elks webhook handling failed:', error);
    res.status(500).send('Webhook handling failed');
  }
};

export const handleTwilioWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // Twilio sends data as form-encoded
    const webhookData = req.body;

    console.log('Received Twilio webhook:', webhookData);

    // Create webhook payload in our standard format
    const payload = {
      providerId: 'twilio',
      event: req.path.includes('voice-start') ? 'voice_start' : 'status_update',
      data: webhookData,
      timestamp: new Date().toISOString()
    };

    // Handle the webhook using TwilioService
    const service = new TwilioService();
    await service.handleWebhook(payload);

    // Log the webhook reception
    if (webhookData.CallSid) {
      await CallEvent.create({
        sessionId: webhookData.CallSid, // Will be mapped to actual session ID in service
        eventType: 'webhook_received', 
        providerId: 'twilio',
        eventData: {
          webhook_type: req.path,
          raw_data: webhookData,
          endpoint: req.originalUrl
        }
      });
    }

    // Respond to Twilio
    if (req.path.includes('voice-start')) {
      // Return TwiML response for voice start
      const twiml = service.generateTwiML('Hej! Jag ringer från ditt företag. Håller på att koppla samtalet...');
      res.set('Content-Type', 'text/xml');
      res.send(twiml);
    } else {
      // Status update - just acknowledge
      res.status(200).send('OK');
    }

  } catch (error) {
    console.error('Twilio webhook handling failed:', error);
    res.status(500).send('Webhook handling failed');
  }
};

export const handleVoiceBridge = async (req: Request, res: Response): Promise<void> => {
  try {
    const { callid, to, from } = req.body;

    console.log('Voice bridge request:', { callid, to, from });

    // Find the call session associated with this telephony call
    const session = await CallSession.findByProviderCallId(callid);
    
    if (!session) {
      console.error('No session found for call:', callid);
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Log the voice bridge event
    await CallEvent.create({
      sessionId: session.id,
      eventType: 'voice_bridge_connected',
      providerId: session.providerId || 'unknown',
      providerCallId: callid,
      eventData: {
        to,
        from,
        bridge_time: new Date().toISOString()
      }
    });

    // Update session status to in_progress
    await session.updateStatus('in_progress');

    // Return instructions for the telephony provider
    // This would typically involve connecting to the AI service
    res.json({
      instruction: 'connect_ai',
      ai_endpoint: `${process.env.AI_WEBHOOK_URL}/voice/${session.id}`,
      session_id: session.id
    });

  } catch (error) {
    console.error('Voice bridge handling failed:', error);
    res.status(500).json({ error: 'Voice bridge failed' });
  }
};

export const validateWebhookSignature = (req: Request, res: Response, next: any): void => {
  try {
    const signature = req.get('X-Webhook-Signature') || req.get('X-Twilio-Signature');
    const providerId = req.path.includes('fortyelks') ? 'fortyelks' : 'twilio';

    // For now, just log the signature validation
    // In production, implement proper signature validation
    console.log(`Webhook signature validation for ${providerId}:`, signature);

    // TODO: Implement actual signature validation
    // For 46elks: HMAC-SHA1 with webhook secret
    // For Twilio: Twilio's signature validation

    next();
  } catch (error) {
    console.error('Webhook signature validation failed:', error);
    res.status(401).send('Invalid signature');
  }
};