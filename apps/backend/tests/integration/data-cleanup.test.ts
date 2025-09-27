import request from 'supertest';
import { app } from '../../src/app';
import { supabase } from '@vocilia/database';

describe('90-Day Data Cleanup Process (T012)', () => {
  let storeId: string;
  let adminToken: string;

  beforeAll(async () => {
    // Create test store
    const storeResult = await supabase
      .from('stores')
      .insert({
        name: 'Test Store for Data Cleanup',
        business_type: 'grocery'
      })
      .select()
      .single();

    storeId = storeResult.data.id;

    // Create admin user for cleanup operations
    const adminUser = await supabase.auth.admin.createUser({
      email: 'cleanup-admin@test.com',
      password: 'AdminPassword123!',
      email_confirm: true
    });

    await supabase
      .from('admin_accounts')
      .insert({
        id: adminUser.data.user.id,
        email: 'cleanup-admin@test.com',
        role: 'super_admin'
      });

    // Get admin auth token
    const authResponse = await request(app)
      .post('/api/admin/auth/login')
      .send({
        email: 'cleanup-admin@test.com',
        password: 'AdminPassword123!'
      });

    adminToken = authResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup all test data
    await supabase
      .from('quality_assessments')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('conversation_transcripts')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('feedback_call_sessions')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('customer_verifications')
      .delete()
      .eq('store_id', storeId);

    await supabase
      .from('stores')
      .delete()
      .eq('id', storeId);

    const adminUsers = await supabase
      .from('admin_accounts')
      .select('id')
      .eq('email', 'cleanup-admin@test.com');

    if (adminUsers.data.length > 0) {
      await supabase.auth.admin.deleteUser(adminUsers.data[0].id);
    }
  });

  describe('Automatic Data Expiration (90-Day Policy)', () => {
    let expiredCallSessionId: string;
    let recentCallSessionId: string;

    beforeEach(async () => {
      // Create expired call session (91 days old)
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 91);

      const expiredSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          store_id: storeId,
          customer_phone_number: '+46701234567',
          status: 'completed',
          call_duration_seconds: 90,
          initiated_at: expiredDate.toISOString(),
          completed_at: expiredDate.toISOString(),
          expires_at: new Date(expiredDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days from initiated_at
        })
        .select()
        .single();

      expiredCallSessionId = expiredSession.data.id;

      // Create conversation transcript for expired session
      await supabase
        .from('conversation_transcripts')
        .insert({
          call_session_id: expiredCallSessionId,
          store_id: storeId,
          messages: [
            {
              speaker: 'ai',
              content: 'Hej! Kan du berätta om din upplevelse?',
              timestamp_ms: 0,
              message_order: 1
            },
            {
              speaker: 'customer',
              content: 'Bra service och trevlig personal',
              timestamp_ms: 5000,
              message_order: 2
            }
          ],
          total_duration_seconds: 90,
          language_detected: 'sv',
          expires_at: new Date(expiredDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
        });

      // Create quality assessment for expired session
      await supabase
        .from('quality_assessments')
        .insert({
          call_session_id: expiredCallSessionId,
          store_id: storeId,
          overall_satisfaction: 0.85,
          service_quality: 0.8,
          product_quality: 0.9,
          cleanliness_rating: 0.8,
          staff_helpfulness: 0.9,
          reward_percentage: 12.5,
          is_fraudulent: false,
          feedback_summary: 'Positive feedback about service quality',
          created_at: expiredDate.toISOString(),
          expires_at: new Date(expiredDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
        });

      // Create recent call session (7 days old)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 7);

      const recentSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          store_id: storeId,
          customer_phone_number: '+46701234568',
          status: 'completed',
          call_duration_seconds: 85,
          initiated_at: recentDate.toISOString(),
          completed_at: recentDate.toISOString(),
          expires_at: new Date(recentDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      recentCallSessionId = recentSession.data.id;

      // Create conversation transcript for recent session
      await supabase
        .from('conversation_transcripts')
        .insert({
          call_session_id: recentCallSessionId,
          store_id: storeId,
          messages: [
            {
              speaker: 'ai',
              content: 'Hej! Hur var din upplevelse idag?',
              timestamp_ms: 0,
              message_order: 1
            },
            {
              speaker: 'customer',
              content: 'Mycket bra, snabb service',
              timestamp_ms: 4000,
              message_order: 2
            }
          ],
          total_duration_seconds: 85,
          language_detected: 'sv',
          expires_at: new Date(recentDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
        });

      // Create quality assessment for recent session
      await supabase
        .from('quality_assessments')
        .insert({
          call_session_id: recentCallSessionId,
          store_id: storeId,
          overall_satisfaction: 0.9,
          service_quality: 0.85,
          product_quality: 0.88,
          cleanliness_rating: 0.9,
          staff_helpfulness: 0.92,
          reward_percentage: 14.0,
          is_fraudulent: false,
          feedback_summary: 'Excellent service experience',
          created_at: recentDate.toISOString(),
          expires_at: new Date(recentDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
        });
    });

    it('should automatically delete expired conversation transcripts', async () => {
      // Trigger cleanup process
      const response = await request(app)
        .delete('/api/ai/analysis/cleanup-low-grade')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quality_threshold: 0.02, // Very low threshold to test expiration, not quality
          dry_run: false
        })
        .expect(200);

      expect(response.body).toHaveProperty('deleted_transcripts');
      expect(response.body).toHaveProperty('preserved_assessments');

      // Verify expired transcript is deleted
      const expiredTranscript = await supabase
        .from('conversation_transcripts')
        .select('*')
        .eq('call_session_id', expiredCallSessionId)
        .maybeSingle();

      expect(expiredTranscript.data).toBeNull();

      // Verify recent transcript is preserved
      const recentTranscript = await supabase
        .from('conversation_transcripts')
        .select('*')
        .eq('call_session_id', recentCallSessionId)
        .single();

      expect(recentTranscript.data).toBeDefined();
      expect(recentTranscript.data.call_session_id).toBe(recentCallSessionId);
    });

    it('should anonymize expired quality assessments but preserve analytics', async () => {
      // Trigger cleanup
      await request(app)
        .delete('/api/ai/analysis/cleanup-low-grade')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quality_threshold: 0.02,
          dry_run: false
        })
        .expect(200);

      // Verify expired quality assessment is anonymized but preserved
      const expiredAssessment = await supabase
        .from('quality_assessments')
        .select('*')
        .eq('call_session_id', expiredCallSessionId)
        .single();

      expect(expiredAssessment.data).toBeDefined();
      // Analytics data should be preserved
      expect(expiredAssessment.data.overall_satisfaction).toBe(0.85);
      expect(expiredAssessment.data.reward_percentage).toBe(12.5);
      // But personal data should be anonymized
      expect(expiredAssessment.data.feedback_summary).toContain('[ANONYMIZED]');

      // Verify recent assessment is unchanged
      const recentAssessment = await supabase
        .from('quality_assessments')
        .select('*')
        .eq('call_session_id', recentCallSessionId)
        .single();

      expect(recentAssessment.data.feedback_summary).toBe('Excellent service experience');
    });

    it('should preserve business reports permanently', async () => {
      // Create weekly report that references expired data
      const expiredWeek = new Date();
      expiredWeek.setDate(expiredWeek.getDate() - 91);
      const weekStart = new Date(expiredWeek);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday

      const report = await supabase
        .from('weekly_analysis_reports')
        .insert({
          store_id: storeId,
          analysis_week: weekStart.toISOString().split('T')[0],
          report_status: 'completed',
          positive_trends: ['Good service feedback'],
          negative_issues: [],
          new_issues: [],
          department_insights: {
            overall: {
              sentiment_score: 0.85,
              mention_count: 1
            }
          },
          trend_analysis: {
            satisfaction_trend: 'stable',
            reward_percentage_avg: 12.5
          },
          actionable_recommendations: ['Continue current service standards']
        })
        .select()
        .single();

      // Trigger cleanup
      await request(app)
        .delete('/api/ai/analysis/cleanup-low-grade')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quality_threshold: 0.02,
          dry_run: false
        })
        .expect(200);

      // Verify business report is preserved
      const preservedReport = await supabase
        .from('weekly_analysis_reports')
        .select('*')
        .eq('id', report.data.id)
        .single();

      expect(preservedReport.data).toBeDefined();
      expect(preservedReport.data.positive_trends).toEqual(['Good service feedback']);
      expect(preservedReport.data.trend_analysis.reward_percentage_avg).toBe(12.5);
    });
  });

  describe('Low-Quality Data Cleanup (2% Threshold)', () => {
    let lowQualitySessionId: string;
    let highQualitySessionId: string;

    beforeEach(async () => {
      // Create low-quality feedback session (1.5% reward)
      const lowQualitySession = await supabase
        .from('feedback_call_sessions')
        .insert({
          store_id: storeId,
          customer_phone_number: '+46701234569',
          status: 'completed',
          call_duration_seconds: 65,
          initiated_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days old
          completed_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      lowQualitySessionId = lowQualitySession.data.id;

      // Create quality assessment with low reward percentage
      await supabase
        .from('quality_assessments')
        .insert({
          call_session_id: lowQualitySessionId,
          store_id: storeId,
          overall_satisfaction: 0.3,
          service_quality: 0.25,
          product_quality: 0.35,
          cleanliness_rating: 0.4,
          staff_helpfulness: 0.2,
          reward_percentage: 1.5, // Below 2% threshold
          is_fraudulent: false,
          feedback_summary: 'Minimal feedback provided',
          positive_highlights: [],
          improvement_areas: ['More detailed feedback needed']
        });

      // Create high-quality feedback session (8% reward)
      const highQualitySession = await supabase
        .from('feedback_call_sessions')
        .insert({
          store_id: storeId,
          customer_phone_number: '+46701234570',
          status: 'completed',
          call_duration_seconds: 95,
          initiated_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days old
          completed_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      highQualitySessionId = highQualitySession.data.id;

      // Create quality assessment with good reward percentage
      await supabase
        .from('quality_assessments')
        .insert({
          call_session_id: highQualitySessionId,
          store_id: storeId,
          overall_satisfaction: 0.85,
          service_quality: 0.8,
          product_quality: 0.9,
          cleanliness_rating: 0.85,
          staff_helpfulness: 0.88,
          reward_percentage: 8.0, // Above 2% threshold
          is_fraudulent: false,
          feedback_summary: 'Detailed positive feedback about store experience',
          positive_highlights: ['Excellent meat department', 'Friendly staff'],
          improvement_areas: []
        });
    });

    it('should remove low-quality feedback below 2% threshold', async () => {
      const response = await request(app)
        .delete('/api/ai/analysis/cleanup-low-grade')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quality_threshold: 0.02, // 2% threshold
          dry_run: false
        })
        .expect(200);

      expect(response.body).toHaveProperty('deleted_low_quality_count');
      expect(response.body.deleted_low_quality_count).toBeGreaterThanOrEqual(1);

      // Verify low-quality assessment is removed
      const lowQualityCheck = await supabase
        .from('quality_assessments')
        .select('*')
        .eq('call_session_id', lowQualitySessionId)
        .maybeSingle();

      expect(lowQualityCheck.data).toBeNull();

      // Verify high-quality assessment is preserved
      const highQualityCheck = await supabase
        .from('quality_assessments')
        .select('*')
        .eq('call_session_id', highQualitySessionId)
        .single();

      expect(highQualityCheck.data).toBeDefined();
      expect(highQualityCheck.data.reward_percentage).toBe(8.0);
    });

    it('should provide dry-run preview of cleanup operations', async () => {
      const response = await request(app)
        .delete('/api/ai/analysis/cleanup-low-grade')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quality_threshold: 0.02,
          dry_run: true
        })
        .expect(200);

      expect(response.body).toHaveProperty('dry_run', true);
      expect(response.body).toHaveProperty('would_delete_expired');
      expect(response.body).toHaveProperty('would_delete_low_quality');
      expect(response.body).toHaveProperty('would_anonymize_assessments');

      // Verify no actual deletions occurred
      const lowQualityCheck = await supabase
        .from('quality_assessments')
        .select('*')
        .eq('call_session_id', lowQualitySessionId)
        .single();

      expect(lowQualityCheck.data).toBeDefined();
      expect(lowQualityCheck.data.reward_percentage).toBe(1.5);
    });
  });

  describe('Fraud Detection Data Cleanup', () => {
    let fraudulentSessionId: string;

    beforeEach(async () => {
      // Create fraudulent session
      const fraudSession = await supabase
        .from('feedback_call_sessions')
        .insert({
          store_id: storeId,
          customer_phone_number: '+46701234571',
          status: 'failed',
          call_duration_seconds: 30,
          initiated_at: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString(), // 95 days old
          completed_at: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      fraudulentSessionId = fraudSession.data.id;

      // Create fraud detection result
      await supabase
        .from('fraud_detection_results')
        .insert({
          call_session_id: fraudulentSessionId,
          store_id: storeId,
          is_fraudulent: true,
          fraud_confidence_score: 0.85,
          fraud_reasons: ['business_hours_violation', 'suspicious_timing'],
          risk_factors: {
            timing_risk: 0.9,
            pattern_risk: 0.8
          },
          created_at: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString()
        });
    });

    it('should preserve fraud detection patterns for security analytics', async () => {
      // Trigger cleanup
      await request(app)
        .delete('/api/ai/analysis/cleanup-low-grade')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quality_threshold: 0.02,
          dry_run: false
        })
        .expect(200);

      // Verify fraud detection result is preserved (anonymized)
      const fraudResult = await supabase
        .from('fraud_detection_results')
        .select('*')
        .eq('call_session_id', fraudulentSessionId)
        .single();

      expect(fraudResult.data).toBeDefined();
      expect(fraudResult.data.is_fraudulent).toBe(true);
      expect(fraudResult.data.fraud_confidence_score).toBe(0.85);
      expect(fraudResult.data.fraud_reasons).toContain('business_hours_violation');
      
      // Risk factors should be preserved for pattern analysis
      expect(fraudResult.data.risk_factors.timing_risk).toBe(0.9);
    });
  });

  describe('Cleanup Scheduling and Monitoring', () => {
    it('should track cleanup operation metrics', async () => {
      const response = await request(app)
        .delete('/api/ai/analysis/cleanup-low-grade')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quality_threshold: 0.02,
          dry_run: false
        })
        .expect(200);

      expect(response.body).toHaveProperty('cleanup_summary');
      expect(response.body.cleanup_summary).toHaveProperty('operation_start_time');
      expect(response.body.cleanup_summary).toHaveProperty('operation_duration_ms');
      expect(response.body.cleanup_summary).toHaveProperty('total_records_processed');
      expect(response.body.cleanup_summary).toHaveProperty('storage_freed_mb');
    });

    it('should enforce admin-only access for cleanup operations', async () => {
      // Try cleanup without admin token
      await request(app)
        .delete('/api/ai/analysis/cleanup-low-grade')
        .send({
          quality_threshold: 0.02,
          dry_run: true
        })
        .expect(401);

      // Try with regular business user token (if available)
      // This would require setting up a business user, omitted for brevity
    });

    it('should provide cleanup status and last run information', async () => {
      // Run cleanup first
      await request(app)
        .delete('/api/ai/analysis/cleanup-low-grade')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quality_threshold: 0.02,
          dry_run: false
        });

      // Check cleanup status
      const statusResponse = await request(app)
        .get('/api/ai/analysis/cleanup-status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('last_cleanup_run');
      expect(statusResponse.body).toHaveProperty('next_scheduled_cleanup');
      expect(statusResponse.body).toHaveProperty('cleanup_statistics');
      expect(statusResponse.body.cleanup_statistics).toHaveProperty('total_runs');
      expect(statusResponse.body.cleanup_statistics).toHaveProperty('average_records_cleaned');
    });
  });
});