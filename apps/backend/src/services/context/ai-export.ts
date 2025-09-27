import { 
  StoreContextProfile, 
  StoreContextPersonnel,
  StoreContextLayout,
  StoreContextInventory
} from '@vocilia/types/src/context';

/**
 * AI context export service for generating AI-ready business context
 * Transforms structured context data into natural language for AI consumption
 */

export interface AIContextExport {
  store_id: string;
  business_context: string;
  structured_data: {
    profile?: StoreContextProfile;
    personnel?: StoreContextPersonnel[];
    layouts?: StoreContextLayout[];
    inventory?: StoreContextInventory;
  };
  export_timestamp: string;
  completeness_score: number;
  version: string;
}

export interface ExportOptions {
  format: 'detailed' | 'summary' | 'concise';
  includePersonalData: boolean;
  includeSensitiveInfo: boolean;
  targetAudience: 'ai_agent' | 'human_review' | 'analytics';
}

/**
 * Service for exporting context data in AI-ready formats
 */
export class AIContextExportService {

  /**
   * Export complete context as AI-ready text
   */
  static async exportContext(
    storeId: string,
    data: {
      profile?: StoreContextProfile;
      personnel?: StoreContextPersonnel[];
      layouts?: StoreContextLayout[];
      inventory?: StoreContextInventory;
    },
    options: ExportOptions = {
      format: 'detailed',
      includePersonalData: false,
      includeSensitiveInfo: false,
      targetAudience: 'ai_agent'
    }
  ): Promise<AIContextExport> {

    const businessContext = this.generateBusinessContext(data, options);
    
    // Calculate completeness (simplified version)
    const completenessScore = this.calculateQuickCompleteness(data);

    return {
      store_id: storeId,
      business_context: businessContext,
      structured_data: options.includeSensitiveInfo ? data : this.sanitizeData(data),
      export_timestamp: new Date().toISOString(),
      completeness_score: completenessScore,
      version: '1.0'
    };
  }

  /**
   * Generate natural language business context for AI
   */
  private static generateBusinessContext(
    data: {
      profile?: StoreContextProfile;
      personnel?: StoreContextPersonnel[];
      layouts?: StoreContextLayout[];
      inventory?: StoreContextInventory;
    },
    options: ExportOptions
  ): string {
    const sections: string[] = [];

    // Store Profile Section
    if (data.profile) {
      sections.push(this.generateProfileContext(data.profile, options));
    }

    // Personnel Section
    if (data.personnel && data.personnel.length > 0) {
      sections.push(this.generatePersonnelContext(data.personnel, options));
    }

    // Layout Section
    if (data.layouts && data.layouts.length > 0) {
      sections.push(this.generateLayoutContext(data.layouts, options));
    }

    // Inventory Section
    if (data.inventory) {
      sections.push(this.generateInventoryContext(data.inventory, options));
    }

    // Combine sections with appropriate formatting
    const intro = options.format === 'concise' 
      ? 'Business Context:\n' 
      : 'Complete Business Context for AI Agent:\n';

    return intro + sections.join('\n\n');
  }

  /**
   * Generate profile context section
   */
  private static generateProfileContext(profile: StoreContextProfile, options: ExportOptions): string {
    const lines: string[] = [];

    if (options.format === 'concise') {
      lines.push(`STORE: ${profile.business_name} - ${profile.store_name}`);
      lines.push(`TYPE: ${profile.store_type}`);
      if (profile.description) {
        lines.push(`DESC: ${profile.description}`);
      }
    } else {
      lines.push('## Store Profile');
      lines.push(`Business: ${profile.business_name}`);
      lines.push(`Store Name: ${profile.store_name}`);
      lines.push(`Store Type: ${profile.store_type}`);
      
      if (profile.description) {
        lines.push(`Description: ${profile.description}`);
      }
      
      if (options.includeSensitiveInfo) {
        lines.push(`Address: ${profile.address}`);
        if (profile.phone) lines.push(`Phone: ${profile.phone}`);
        if (profile.email) lines.push(`Email: ${profile.email}`);
      }
      
      if (profile.website) {
        lines.push(`Website: ${profile.website}`);
      }
      
      if (profile.size_sqft) {
        lines.push(`Size: ${profile.size_sqft} sq ft`);
      }
      
      if (profile.capacity) {
        lines.push(`Capacity: ${profile.capacity} customers`);
      }
      
      if (profile.target_demographics) {
        lines.push(`Target Customers: ${profile.target_demographics}`);
      }

      // Operating Hours
      if (profile.operating_hours && profile.operating_hours.length > 0) {
        lines.push('\n### Operating Hours');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        profile.operating_hours.forEach(hours => {
          const dayName = days[hours.day_of_week];
          if (hours.is_closed) {
            lines.push(`${dayName}: Closed`);
          } else {
            lines.push(`${dayName}: ${hours.open_time} - ${hours.close_time}`);
          }
        });
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate personnel context section
   */
  private static generatePersonnelContext(personnel: StoreContextPersonnel[], options: ExportOptions): string {
    const lines: string[] = [];

    if (options.format === 'concise') {
      lines.push(`TEAM: ${personnel.length} members`);
      const roles = [...new Set(personnel.map(p => p.role))];
      lines.push(`ROLES: ${roles.join(', ')}`);
    } else {
      lines.push('## Team & Personnel');
      lines.push(`Total Team Members: ${personnel.length}`);
      
      personnel.forEach((person, index) => {
        lines.push(`\n### ${options.includePersonalData ? person.name : `Team Member ${index + 1}`}`);
        lines.push(`Role: ${person.role}`);
        lines.push(`Department: ${person.department}`);
        lines.push(`Seniority: ${person.seniority_level}`);
        lines.push(`Customer Interaction Level: ${person.customer_interaction}`);
        
        if (person.specializations && person.specializations.length > 0) {
          lines.push(`Specializations: ${person.specializations.join(', ')}`);
        }
        
        if (person.shifts && person.shifts.length > 0 && options.format === 'detailed') {
          lines.push('Schedule:');
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          person.shifts.forEach(shift => {
            const day = days[shift.day_of_week];
            lines.push(`  ${day}: ${shift.start_time} - ${shift.end_time}`);
          });
        }
      });

      // Summary insights
      const departments = [...new Set(personnel.map(p => p.department))];
      const highInteraction = personnel.filter(p => p.customer_interaction === 'high').length;
      
      lines.push('\n### Team Summary');
      lines.push(`Departments: ${departments.join(', ')}`);
      lines.push(`High Customer Interaction Staff: ${highInteraction}/${personnel.length}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate layout context section
   */
  private static generateLayoutContext(layouts: StoreContextLayout[], options: ExportOptions): string {
    const lines: string[] = [];
    const primaryLayout = layouts[0]; // Focus on primary layout

    if (options.format === 'concise') {
      lines.push(`LAYOUT: ${primaryLayout.name || 'Store Layout'}`);
      if (primaryLayout.departments) {
        const deptNames = primaryLayout.departments.map(d => d.name);
        lines.push(`AREAS: ${deptNames.join(', ')}`);
      }
    } else {
      lines.push('## Store Layout');
      lines.push(`Layout Name: ${primaryLayout.name || 'Primary Layout'}`);
      
      if (primaryLayout.description) {
        lines.push(`Description: ${primaryLayout.description}`);
      }
      
      if (primaryLayout.total_area_sqft) {
        lines.push(`Total Area: ${primaryLayout.total_area_sqft} sq ft`);
      }

      if (primaryLayout.departments && primaryLayout.departments.length > 0) {
        lines.push('\n### Departments & Areas');
        
        // Group by category for better organization
        const byCategory = primaryLayout.departments.reduce((acc, dept) => {
          if (!acc[dept.category]) acc[dept.category] = [];
          acc[dept.category].push(dept);
          return acc;
        }, {} as Record<string, typeof primaryLayout.departments>);

        Object.entries(byCategory).forEach(([category, depts]) => {
          lines.push(`\n**${category.charAt(0).toUpperCase() + category.slice(1)} Areas:**`);
          depts.forEach(dept => {
            if (options.format === 'detailed') {
              lines.push(`- ${dept.name}: ${dept.width}x${dept.height} units at (${dept.x_position}, ${dept.y_position})`);
              if (dept.description) {
                lines.push(`  ${dept.description}`);
              }
            } else {
              lines.push(`- ${dept.name}`);
            }
          });
        });

        // Spatial insights
        const entranceAreas = primaryLayout.departments.filter(d => d.category === 'entrance');
        const checkoutAreas = primaryLayout.departments.filter(d => d.category === 'checkout');
        
        if (entranceAreas.length > 0 || checkoutAreas.length > 0) {
          lines.push('\n### Store Flow');
          if (entranceAreas.length > 0) {
            lines.push(`Entrances: ${entranceAreas.map(e => e.name).join(', ')}`);
          }
          if (checkoutAreas.length > 0) {
            lines.push(`Checkout Areas: ${checkoutAreas.map(c => c.name).join(', ')}`);
          }
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate inventory context section
   */
  private static generateInventoryContext(inventory: StoreContextInventory, options: ExportOptions): string {
    const lines: string[] = [];

    if (options.format === 'concise') {
      if (inventory.categories) {
        const categoryNames = inventory.categories.map(c => c.name);
        lines.push(`PRODUCTS: ${categoryNames.join(', ')}`);
      }
    } else {
      lines.push('## Product Inventory');
      
      if (inventory.categories && inventory.categories.length > 0) {
        lines.push(`Total Categories: ${inventory.categories.length}`);
        
        // Group by priority
        const byPriority = inventory.categories.reduce((acc, cat) => {
          if (!acc[cat.priority]) acc[cat.priority] = [];
          acc[cat.priority].push(cat);
          return acc;
        }, {} as Record<string, typeof inventory.categories>);

        ['high', 'medium', 'low'].forEach(priority => {
          if (byPriority[priority] && byPriority[priority].length > 0) {
            lines.push(`\n### ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority Categories`);
            byPriority[priority].forEach(cat => {
              if (options.format === 'detailed') {
                lines.push(`- **${cat.name}**`);
                if (cat.description) {
                  lines.push(`  ${cat.description}`);
                }
                if (cat.parent_category) {
                  lines.push(`  Parent Category: ${cat.parent_category}`);
                }
                if (cat.seasonal) {
                  lines.push(`  Seasonal Product`);
                }
                if (cat.target_margin) {
                  lines.push(`  Target Margin: ${cat.target_margin}%`);
                }
              } else {
                const details = [];
                if (cat.parent_category) details.push(`under ${cat.parent_category}`);
                if (cat.seasonal) details.push('seasonal');
                lines.push(`- ${cat.name}${details.length > 0 ? ` (${details.join(', ')})` : ''}`);
              }
            });
          }
        });
      }

      // Strategic information
      if (inventory.seasonal_patterns) {
        lines.push(`\n### Seasonal Patterns`);
        lines.push(inventory.seasonal_patterns);
      }

      if (inventory.supplier_preferences && options.includeSensitiveInfo) {
        lines.push(`\n### Supplier Strategy`);
        lines.push(inventory.supplier_preferences);
      }

      if (inventory.pricing_strategy && options.includeSensitiveInfo) {
        lines.push(`\n### Pricing Strategy`);
        lines.push(inventory.pricing_strategy);
      }
    }

    return lines.join('\n');
  }

  /**
   * Calculate quick completeness score
   */
  private static calculateQuickCompleteness(data: {
    profile?: StoreContextProfile;
    personnel?: StoreContextPersonnel[];
    layouts?: StoreContextLayout[];
    inventory?: StoreContextInventory;
  }): number {
    let score = 0;
    
    if (data.profile) score += 40;
    if (data.personnel && data.personnel.length > 0) score += 25;
    if (data.layouts && data.layouts.length > 0) score += 20;
    if (data.inventory) score += 15;
    
    return score;
  }

  /**
   * Sanitize data by removing sensitive information
   */
  private static sanitizeData(data: {
    profile?: StoreContextProfile;
    personnel?: StoreContextPersonnel[];
    layouts?: StoreContextLayout[];
    inventory?: StoreContextInventory;
  }) {
    const sanitized = { ...data };

    // Remove sensitive profile data
    if (sanitized.profile) {
      const cleanProfile = { ...sanitized.profile };
      delete (cleanProfile as any).address;
      delete (cleanProfile as any).phone;
      delete (cleanProfile as any).email;
      sanitized.profile = cleanProfile;
    }

    // Remove personal names from personnel
    if (sanitized.personnel) {
      sanitized.personnel = sanitized.personnel.map((person, index) => ({
        ...person,
        name: `Team Member ${index + 1}`
      }));
    }

    // Remove sensitive business strategy info
    if (sanitized.inventory) {
      const cleanInventory = { ...sanitized.inventory };
      delete (cleanInventory as any).supplier_preferences;
      delete (cleanInventory as any).pricing_strategy;
      sanitized.inventory = cleanInventory;
    }

    return sanitized;
  }

  /**
   * Generate AI prompt-ready context summary
   */
  static generateAIPromptContext(contextExport: AIContextExport): string {
    return `
BUSINESS CONTEXT FOR AI AGENT:
${contextExport.business_context}

CONTEXT COMPLETENESS: ${contextExport.completeness_score}%
LAST UPDATED: ${contextExport.export_timestamp}

Use this context to provide personalized, relevant responses to customer feedback and inquiries about this business.
`.trim();
  }

  /**
   * Export context for specific AI use cases
   */
  static async exportForUseCase(
    storeId: string,
    data: {
      profile?: StoreContextProfile;
      personnel?: StoreContextPersonnel[];
      layouts?: StoreContextLayout[];
      inventory?: StoreContextInventory;
    },
    useCase: 'customer_feedback' | 'recommendation_engine' | 'analytics' | 'general'
  ): Promise<string> {
    
    let options: ExportOptions;
    
    switch (useCase) {
      case 'customer_feedback':
        options = {
          format: 'summary',
          includePersonalData: false,
          includeSensitiveInfo: false,
          targetAudience: 'ai_agent'
        };
        break;
      case 'recommendation_engine':
        options = {
          format: 'detailed',
          includePersonalData: false,
          includeSensitiveInfo: false,
          targetAudience: 'ai_agent'
        };
        break;
      case 'analytics':
        options = {
          format: 'concise',
          includePersonalData: false,
          includeSensitiveInfo: true,
          targetAudience: 'analytics'
        };
        break;
      default:
        options = {
          format: 'summary',
          includePersonalData: false,
          includeSensitiveInfo: false,
          targetAudience: 'ai_agent'
        };
    }

    const exported = await this.exportContext(storeId, data, options);
    return exported.business_context;
  }
}