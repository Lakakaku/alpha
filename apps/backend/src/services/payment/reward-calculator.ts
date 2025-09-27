import { dinero, multiply, toUnits, Dinero } from 'dinero.js';
import { SEK } from '@dinero.js/currencies';
import type { RewardCalculation, RewardCalculationInsert } from '@vocilia/types';
import { RewardCalculationQueries } from '@vocilia/database';
import { SupabaseClient } from '@supabase/supabase-js';

type SEKAmount = Dinero<number>;

export class RewardCalculatorService {
  private rewardQueries: RewardCalculationQueries;

  constructor(private client: SupabaseClient) {
    this.rewardQueries = new RewardCalculationQueries(client);
  }

  calculateRewardPercentage(qualityScore: number): number {
    if (qualityScore < 50) return 0;
    
    const normalizedScore = (qualityScore - 50) / 50;
    const rewardRange = 15 - 2;
    const rewardPercentage = normalizedScore * rewardRange + 2;
    
    return Number(rewardPercentage.toFixed(3));
  }

  calculateRewardAmount(transactionAmountSek: number, rewardPercentage: number): number {
    const transactionInOre = Math.round(transactionAmountSek * 100);
    const transaction = dinero({ amount: transactionInOre, currency: SEK });
    
    const percentageScaled = { 
      amount: Math.round(rewardPercentage * 100000), 
      scale: 5 
    };
    
    const rewardAmount = multiply(transaction, percentageScaled);
    const units = toUnits(rewardAmount);
    const rewardInOre = units[0] || 0;
    
    return Math.round(rewardInOre);
  }

  async calculateRewardsForFeedback(feedbackIds: string[]): Promise<{
    calculatedCount: number;
    totalRewardAmountSek: number;
    results: Array<{
      feedbackId: string;
      customerPhone: string;
      qualityScore: number;
      rewardPercentage: number;
      transactionAmountSek: number;
      rewardAmountSek: number;
      calculatedAt: string;
    }>;
  }> {
    const feedbackData = await this.client
      .from('feedback_sessions')
      .select('id, customer_phone_e164, quality_score, verified_by_business, transaction_id, transactions(amount_sek), store_id')
      .in('id', feedbackIds);

    if (feedbackData.error) throw feedbackData.error;

    const validFeedback = feedbackData.data?.filter(f => 
      f.verified_by_business && f.quality_score >= 50
    ) || [];

    const calculationsToInsert: RewardCalculationInsert[] = [];
    const results: any[] = [];
    let totalRewardOre = 0;

    for (const feedback of validFeedback) {
      const rewardPercentage = this.calculateRewardPercentage(feedback.quality_score);
      const transactionAmountSek = (feedback.transactions as any)?.amount_sek || 0;
      const rewardAmountOre = this.calculateRewardAmount(transactionAmountSek, rewardPercentage);

      calculationsToInsert.push({
        feedback_id: feedback.id,
        transaction_id: feedback.transaction_id!,
        store_id: feedback.store_id,
        customer_phone: feedback.customer_phone_e164,
        quality_score: feedback.quality_score,
        reward_percentage: rewardPercentage / 100,
        transaction_amount_sek: Math.round(transactionAmountSek * 100),
        reward_amount_sek: rewardAmountOre,
        verified_by_business: true,
        verified_at: new Date().toISOString()
      });

      results.push({
        feedbackId: feedback.id,
        customerPhone: feedback.customer_phone_e164,
        qualityScore: feedback.quality_score,
        rewardPercentage: rewardPercentage / 100,
        transactionAmountSek,
        rewardAmountSek: rewardAmountOre / 100,
        calculatedAt: new Date().toISOString()
      });

      totalRewardOre += rewardAmountOre;
    }

    if (calculationsToInsert.length > 0) {
      await this.rewardQueries.createMany(calculationsToInsert);
    }

    return {
      calculatedCount: validFeedback.length,
      totalRewardAmountSek: totalRewardOre / 100,
      results
    };
  }
}