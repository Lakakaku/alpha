import { 
  StoreContextProfile, 
  StoreContextPersonnel,
  StoreContextLayout,
  StoreContextInventory,
  ContextCompleteness
} from '@vocilia/types/src/context';

/**
 * Context completeness calculator service
 * Calculates completion scores and identifies missing information
 */

export interface CompletenessWeights {
  profile: number;
  personnel: number;
  layout: number;
  inventory: number;
}

export interface CompletenessDetail {
  section: string;
  score: number;
  maxScore: number;
  missingFields: string[];
  recommendations: string[];
}

/**
 * Service for calculating context completeness scores
 */
export class ContextCompletenessService {
  
  private static readonly DEFAULT_WEIGHTS: CompletenessWeights = {
    profile: 0.4,    // 40% - Most important for AI context
    personnel: 0.25, // 25% - Important for service understanding
    layout: 0.2,     // 20% - Helpful for spatial context
    inventory: 0.15  // 15% - Useful for product recommendations
  };

  /**
   * Calculate overall completeness score for a store's context
   */
  static calculateCompleteness(
    data: {
      profile?: StoreContextProfile;
      personnel?: StoreContextPersonnel[];
      layouts?: StoreContextLayout[];
      inventory?: StoreContextInventory;
    },
    weights: CompletenessWeights = this.DEFAULT_WEIGHTS
  ): ContextCompleteness {
    
    const profileDetail = this.calculateProfileCompleteness(data.profile);
    const personnelDetail = this.calculatePersonnelCompleteness(data.personnel);
    const layoutDetail = this.calculateLayoutCompleteness(data.layouts);
    const inventoryDetail = this.calculateInventoryCompleteness(data.inventory);

    // Calculate weighted overall score
    const overallScore = Math.round(
      (profileDetail.score * weights.profile) +
      (personnelDetail.score * weights.personnel) +
      (layoutDetail.score * weights.layout) +
      (inventoryDetail.score * weights.inventory)
    );

    // Determine completion status
    let status: 'incomplete' | 'basic' | 'good' | 'excellent';
    if (overallScore < 30) status = 'incomplete';
    else if (overallScore < 60) status = 'basic';
    else if (overallScore < 85) status = 'good';
    else status = 'excellent';

    // Generate priority recommendations
    const recommendations = this.generateRecommendations([
      profileDetail,
      personnelDetail,
      layoutDetail,
      inventoryDetail
    ]);

    return {
      overall_score: overallScore,
      status,
      profile_score: profileDetail.score,
      personnel_score: personnelDetail.score,
      layout_score: layoutDetail.score,
      inventory_score: inventoryDetail.score,
      missing_sections: this.getMissingSections([
        profileDetail,
        personnelDetail,
        layoutDetail,
        inventoryDetail
      ]),
      recommendations,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Calculate profile section completeness
   */
  private static calculateProfileCompleteness(profile?: StoreContextProfile): CompletenessDetail {
    if (!profile) {
      return {
        section: 'profile',
        score: 0,
        maxScore: 100,
        missingFields: ['All profile information'],
        recommendations: ['Add basic store information to get started']
      };
    }

    const fields = [
      { key: 'business_name', required: true, weight: 10 },
      { key: 'store_name', required: true, weight: 10 },
      { key: 'store_type', required: true, weight: 8 },
      { key: 'description', required: false, weight: 6 },
      { key: 'address', required: true, weight: 8 },
      { key: 'phone', required: false, weight: 4 },
      { key: 'email', required: false, weight: 4 },
      { key: 'website', required: false, weight: 3 },
      { key: 'size_sqft', required: false, weight: 5 },
      { key: 'capacity', required: false, weight: 5 },
      { key: 'target_demographics', required: false, weight: 7 },
      { key: 'operating_hours', required: true, weight: 10 }
    ];

    let score = 0;
    let maxScore = 0;
    const missingFields: string[] = [];

    fields.forEach(field => {
      maxScore += field.weight;
      const value = (profile as any)[field.key];
      
      if (field.key === 'operating_hours') {
        if (value && Array.isArray(value) && value.length === 7) {
          const validHours = value.filter(h => 
            h.day_of_week !== undefined && 
            (h.is_closed || (h.open_time && h.close_time))
          );
          score += (validHours.length / 7) * field.weight;
          if (validHours.length < 7) {
            missingFields.push('Complete operating hours for all days');
          }
        } else {
          missingFields.push('Operating hours');
        }
      } else if (value !== undefined && value !== null && value !== '') {
        score += field.weight;
      } else if (field.required) {
        missingFields.push(field.key.replace('_', ' '));
      }
    });

    const finalScore = Math.round((score / maxScore) * 100);
    
    const recommendations: string[] = [];
    if (missingFields.length > 0) {
      recommendations.push(`Complete missing fields: ${missingFields.slice(0, 3).join(', ')}`);
    }
    if (!profile.description) {
      recommendations.push('Add a store description to help AI understand your business');
    }
    if (!profile.target_demographics) {
      recommendations.push('Define target demographics for better customer insights');
    }

    return {
      section: 'profile',
      score: finalScore,
      maxScore: 100,
      missingFields,
      recommendations
    };
  }

  /**
   * Calculate personnel section completeness
   */
  private static calculatePersonnelCompleteness(personnel?: StoreContextPersonnel[]): CompletenessDetail {
    if (!personnel || personnel.length === 0) {
      return {
        section: 'personnel',
        score: 0,
        maxScore: 100,
        missingFields: ['All personnel information'],
        recommendations: ['Add team members to help AI understand service capabilities']
      };
    }

    let totalScore = 0;
    const missingFields: string[] = [];
    const recommendations: string[] = [];

    personnel.forEach((person, index) => {
      let personScore = 0;
      const maxPersonScore = 100;

      // Required fields (80% of score)
      const requiredFields = [
        { key: 'name', weight: 20 },
        { key: 'role', weight: 20 },
        { key: 'department', weight: 15 },
        { key: 'seniority_level', weight: 10 },
        { key: 'customer_interaction', weight: 15 }
      ];

      requiredFields.forEach(field => {
        if ((person as any)[field.key]) {
          personScore += field.weight;
        } else {
          missingFields.push(`Person ${index + 1}: ${field.key.replace('_', ' ')}`);
        }
      });

      // Optional but valuable fields (20% of score)
      if (person.specializations && person.specializations.length > 0) {
        personScore += 10;
      }
      if (person.shifts && person.shifts.length > 0) {
        personScore += 10;
      } else {
        missingFields.push(`Person ${index + 1}: shift schedule`);
      }

      totalScore += (personScore / maxPersonScore) * 100;
    });

    const finalScore = Math.round(totalScore / personnel.length);

    // Generate recommendations
    if (personnel.length < 3) {
      recommendations.push('Add more team members for comprehensive context');
    }
    if (personnel.some(p => !p.shifts || p.shifts.length === 0)) {
      recommendations.push('Add shift schedules to understand availability');
    }
    if (personnel.some(p => !p.specializations || p.specializations.length === 0)) {
      recommendations.push('Add specializations to highlight unique skills');
    }

    return {
      section: 'personnel',
      score: finalScore,
      maxScore: 100,
      missingFields: missingFields.slice(0, 5), // Limit to top 5 missing items
      recommendations
    };
  }

  /**
   * Calculate layout section completeness
   */
  private static calculateLayoutCompleteness(layouts?: StoreContextLayout[]): CompletenessDetail {
    if (!layouts || layouts.length === 0) {
      return {
        section: 'layout',
        score: 0,
        maxScore: 100,
        missingFields: ['All layout information'],
        recommendations: ['Create a store layout to help AI understand spatial context']
      };
    }

    // For now, score the primary layout (first one)
    const primaryLayout = layouts[0];
    let score = 0;
    const missingFields: string[] = [];
    const recommendations: string[] = [];

    // Basic layout info (40% of score)
    if (primaryLayout.name) score += 15;
    else missingFields.push('Layout name');

    if (primaryLayout.description) score += 10;
    else missingFields.push('Layout description');

    if (primaryLayout.total_area_sqft) score += 15;
    else missingFields.push('Total area');

    // Departments (60% of score)
    if (primaryLayout.departments && primaryLayout.departments.length > 0) {
      const deptScore = Math.min(primaryLayout.departments.length * 10, 60);
      score += deptScore;
      
      if (primaryLayout.departments.length < 3) {
        recommendations.push('Add more departments for detailed spatial context');
      }
      
      // Check department completeness
      const incompleteDepts = primaryLayout.departments.filter(dept => 
        !dept.name || !dept.category || dept.x_position === undefined
      );
      if (incompleteDepts.length > 0) {
        missingFields.push(`${incompleteDepts.length} incomplete departments`);
      }
    } else {
      missingFields.push('Department layout');
      recommendations.push('Add departments to map out your store layout');
    }

    if (!primaryLayout.image_url) {
      recommendations.push('Upload a layout image for visual reference');
    }

    return {
      section: 'layout',
      score: Math.min(score, 100),
      maxScore: 100,
      missingFields,
      recommendations
    };
  }

  /**
   * Calculate inventory section completeness
   */
  private static calculateInventoryCompleteness(inventory?: StoreContextInventory): CompletenessDetail {
    if (!inventory) {
      return {
        section: 'inventory',
        score: 0,
        maxScore: 100,
        missingFields: ['All inventory information'],
        recommendations: ['Add inventory categories to help AI understand your products']
      };
    }

    let score = 0;
    const missingFields: string[] = [];
    const recommendations: string[] = [];

    // Categories (70% of score)
    if (inventory.categories && inventory.categories.length > 0) {
      const categoryScore = Math.min(inventory.categories.length * 10, 70);
      score += categoryScore;
      
      if (inventory.categories.length < 5) {
        recommendations.push('Add more product categories for comprehensive coverage');
      }
      
      // Check category completeness
      const incompleteCategories = inventory.categories.filter(cat => 
        !cat.name || !cat.priority
      );
      if (incompleteCategories.length > 0) {
        missingFields.push(`${incompleteCategories.length} incomplete categories`);
      }
    } else {
      missingFields.push('Product categories');
      recommendations.push('Add product categories to define your inventory');
    }

    // Optional strategic info (30% of score)
    if (inventory.seasonal_patterns) score += 10;
    else missingFields.push('Seasonal patterns');

    if (inventory.supplier_preferences) score += 10;
    else missingFields.push('Supplier preferences');

    if (inventory.pricing_strategy) score += 10;
    else missingFields.push('Pricing strategy');

    if (!inventory.seasonal_patterns) {
      recommendations.push('Add seasonal patterns to improve trend analysis');
    }

    return {
      section: 'inventory',
      score: Math.min(score, 100),
      maxScore: 100,
      missingFields,
      recommendations
    };
  }

  /**
   * Get sections that are completely missing
   */
  private static getMissingSections(details: CompletenessDetail[]): string[] {
    return details
      .filter(detail => detail.score === 0)
      .map(detail => detail.section);
  }

  /**
   * Generate priority recommendations across all sections
   */
  private static generateRecommendations(details: CompletenessDetail[]): string[] {
    const allRecommendations: Array<{ text: string; priority: number }> = [];

    details.forEach(detail => {
      detail.recommendations.forEach(rec => {
        // Priority based on section importance and current score
        let priority = 100 - detail.score;
        if (detail.section === 'profile') priority += 20; // Profile is most important
        if (detail.section === 'personnel') priority += 10;
        
        allRecommendations.push({ text: rec, priority });
      });
    });

    // Sort by priority and return top 5
    return allRecommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5)
      .map(r => r.text);
  }

  /**
   * Get AI readiness score based on completeness
   */
  static getAIReadinessScore(completeness: ContextCompleteness): {
    score: number;
    status: 'not_ready' | 'basic' | 'good' | 'excellent';
    requirements: string[];
  } {
    const requirements: string[] = [];
    
    // Minimum requirements for AI functionality
    if (completeness.profile_score < 60) {
      requirements.push('Complete basic store profile (minimum 60%)');
    }
    if (completeness.personnel_score < 30) {
      requirements.push('Add at least some team member information');
    }
    
    // Calculate AI readiness
    let aiScore = 0;
    if (completeness.profile_score >= 60) aiScore += 50;
    if (completeness.personnel_score >= 30) aiScore += 20;
    if (completeness.layout_score >= 40) aiScore += 15;
    if (completeness.inventory_score >= 40) aiScore += 15;
    
    let status: 'not_ready' | 'basic' | 'good' | 'excellent';
    if (aiScore < 50) status = 'not_ready';
    else if (aiScore < 70) status = 'basic';
    else if (aiScore < 90) status = 'good';
    else status = 'excellent';

    return { score: aiScore, status, requirements };
  }
}