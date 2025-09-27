import { supabase } from '../../../../packages/database/src/client/supabase';
import { callManagerService } from './callManagerService';

interface VerificationCompletedEvent {
  verification_id: string;
  customer_phone: string;
  store_id: string;
  qr_code: string;
  verified_at: string;
  verification_score: number;
}

interface StoreConfiguration {
  id: string;
  name: string;
  is_active: boolean;
  ai_calls_enabled: boolean;
  call_delay_hours: number;
  min_verification_score: number;
  business_context_id?: string;
}

class VerificationEventHandler {
  private readonly VERIFICATION_CHANNEL = 'customer_verification_completed';
  private isListening = false;

  constructor() {
    this.startListening();
  }

  // Start listening for verification completion events
  async startListening(): Promise<void> {
    if (this.isListening) {
      return;
    }

    try {
      // Subscribe to real-time verification events
      const subscription = supabase
        .channel(this.VERIFICATION_CHANNEL)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'customer_verification',
            filter: 'status=eq.verified'
          },
          async (payload) => {
            console.log('Verification completed event received:', payload);
            await this.handleVerificationCompleted(payload.new as any);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Verification event handler subscribed successfully');
            this.isListening = true;
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Failed to subscribe to verification events');
            this.isListening = false;
          }
        });

    } catch (error) {
      console.error('Error starting verification event listener:', error);
    }
  }

  // Handle verification completion event
  private async handleVerificationCompleted(verification: any): Promise<void> {
    try {
      console.log(`Processing verification completed: ${verification.id}`);

      // Get store configuration
      const storeConfig = await this.getStoreConfiguration(verification.store_id);
      
      if (!storeConfig) {
        console.log(`Store ${verification.store_id} not found or inactive`);
        return;
      }

      // Check if AI calls are enabled for this store
      if (!storeConfig.ai_calls_enabled) {
        console.log(`AI calls disabled for store ${verification.store_id}`);
        return;
      }

      // Check verification score meets minimum threshold
      if (verification.verification_score < storeConfig.min_verification_score) {
        console.log(`Verification score ${verification.verification_score} below threshold ${storeConfig.min_verification_score}`);
        return;
      }

      // Check if customer has recent feedback call (prevent spam)
      const hasRecentCall = await this.checkRecentFeedbackCall(
        verification.customer_phone,
        verification.store_id
      );

      if (hasRecentCall) {
        console.log(`Customer ${verification.customer_phone} has recent feedback call, skipping`);
        return;
      }

      // Get business context for the call
      const businessContext = await this.getBusinessContext(verification.store_id);
      
      if (!businessContext) {
        console.log(`No business context found for store ${verification.store_id}`);
        return;
      }

      // Schedule feedback call with configured delay
      await this.scheduleFeedbackCall(verification, storeConfig, businessContext);

    } catch (error) {
      console.error('Error handling verification completed event:', error);
    }
  }

  // Get store configuration including AI call settings
  private async getStoreConfiguration(storeId: string): Promise<StoreConfiguration | null> {
    const { data: store, error } = await supabase
      .from('stores')
      .select(`
        id,
        name,
        is_active,
        ai_calls_enabled,
        call_delay_hours,
        min_verification_score,
        business_context_profiles (
          id
        )
      `)
      .eq('id', storeId)
      .eq('is_active', true)
      .single();

    if (error || !store) {
      return null;
    }

    return {
      id: store.id,
      name: store.name,
      is_active: store.is_active,
      ai_calls_enabled: store.ai_calls_enabled || false,
      call_delay_hours: store.call_delay_hours || 24,
      min_verification_score: store.min_verification_score || 0.7,
      business_context_id: store.business_context_profiles?.[0]?.id
    };
  }

  // Check if customer has received a feedback call recently (within 30 days)
  private async checkRecentFeedbackCall(
    customerPhone: string,
    storeId: string
  ): Promise<boolean> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentCalls } = await supabase
      .from('feedback_call_sessions')
      .select('id')
      .eq('phone_number', customerPhone)
      .eq('store_id', storeId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .limit(1);

    return (recentCalls?.length || 0) > 0;
  }

  // Get business context profile for AI conversation
  private async getBusinessContext(storeId: string): Promise<any | null> {
    const { data: context, error } = await supabase
      .from('business_context_profiles')
      .select('*')
      .eq('store_id', storeId)
      .order('context_version', { ascending: false })
      .limit(1)
      .single();

    if (error || !context) {
      console.log(`No business context found for store ${storeId}`);
      return null;
    }

    return {
      storeName: context.store_name,
      departments: context.departments || [],
      currentCampaigns: context.current_campaigns || {},
      operatingHours: context.operating_hours || {},
      customQuestions: context.question_configuration || [],
      baselineFacts: context.baseline_facts || {}
    };
  }

  // Schedule feedback call with appropriate delay
  private async scheduleFeedbackCall(
    verification: any,
    storeConfig: StoreConfiguration,
    businessContext: any
  ): Promise<void> {
    const callTime = new Date();
    callTime.setHours(callTime.getHours() + storeConfig.call_delay_hours);

    console.log(`Scheduling feedback call for ${verification.customer_phone} at ${callTime.toISOString()}`);

    // Create feedback call session
    const { data: callSession, error: sessionError } = await supabase
      .from('feedback_call_sessions')
      .insert({
        customer_verification_id: verification.id,
        store_id: verification.store_id,
        phone_number: verification.customer_phone,
        session_status: 'pending',
        retry_count: 0,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + (90 * 24 * 60 * 60 * 1000)).toISOString() // 90 days
      })
      .select()
      .single();

    if (sessionError || !callSession) {
      console.error('Failed to create feedback call session:', sessionError);
      return;
    }

    // Schedule the actual call
    if (storeConfig.call_delay_hours <= 0) {
      // Immediate call
      await this.initiateImmediateCall(callSession.id, businessContext);
    } else {
      // Delayed call
      await this.scheduleDelayedCall(callSession.id, callTime, businessContext);
    }
  }

  // Initiate call immediately
  private async initiateImmediateCall(sessionId: string, businessContext: any): Promise<void> {
    try {
      console.log(`Initiating immediate feedback call: ${sessionId}`);
      await callManagerService.initiateCall(sessionId, businessContext);
    } catch (error) {
      console.error('Failed to initiate immediate call:', error);
      
      // Mark session as failed
      await supabase
        .from('feedback_call_sessions')
        .update({
          session_status: 'failed',
          failure_reason: 'Immediate call initiation failed'
        })
        .eq('id', sessionId);
    }
  }

  // Schedule call for later execution
  private async scheduleDelayedCall(
    sessionId: string,
    callTime: Date,
    businessContext: any
  ): Promise<void> {
    const delayMs = callTime.getTime() - Date.now();
    
    if (delayMs <= 0) {
      await this.initiateImmediateCall(sessionId, businessContext);
      return;
    }

    // Use setTimeout for delays up to 24 hours
    if (delayMs <= 24 * 60 * 60 * 1000) {
      setTimeout(async () => {
        try {
          console.log(`Executing scheduled feedback call: ${sessionId}`);
          await callManagerService.initiateCall(sessionId, businessContext);
        } catch (error) {
          console.error('Failed to execute scheduled call:', error);
          
          await supabase
            .from('feedback_call_sessions')
            .update({
              session_status: 'failed',
              failure_reason: 'Scheduled call execution failed'
            })
            .eq('id', sessionId);
        }
      }, delayMs);

      console.log(`Scheduled feedback call ${sessionId} for ${callTime.toISOString()}`);
    } else {
      // For longer delays, store scheduling info and use a job queue
      console.log(`Long delay scheduled call ${sessionId} - storing for job queue processing`);
      
      // Store scheduling information for job queue pickup
      await supabase
        .from('scheduled_calls')
        .insert({
          call_session_id: sessionId,
          scheduled_for: callTime.toISOString(),
          business_context: businessContext,
          status: 'scheduled'
        });
    }
  }

  // Stop listening for events
  async stopListening(): Promise<void> {
    if (this.isListening) {
      await supabase.removeAllChannels();
      this.isListening = false;
      console.log('Verification event handler stopped listening');
    }
  }

  // Get handler status
  getStatus(): { listening: boolean; channelName: string } {
    return {
      listening: this.isListening,
      channelName: this.VERIFICATION_CHANNEL
    };
  }
}

// Export singleton instance
export const verificationEventHandler = new VerificationEventHandler();