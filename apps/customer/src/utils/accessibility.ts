/**
 * Accessibility Utilities
 * Screen reader support and WCAG compliance helpers
 */

interface ScreenReaderAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
  timeout?: number;
}

interface KeyboardNavigation {
  element: HTMLElement;
  skipLinks: boolean;
  focusManagement: boolean;
  ariaLabels: boolean;
}

interface WCAGCompliance {
  level: 'A' | 'AA' | 'AAA';
  requirements: string[];
  passed: boolean;
  failed: string[];
  warnings: string[];
}

/**
 * Screen Reader Support Utilities
 */
export class ScreenReaderSupport {
  private static announcementRegion: HTMLElement | null = null;
  private static messageQueue: ScreenReaderAnnouncement[] = [];
  private static isProcessingQueue = false;

  /**
   * Initialize screen reader support
   */
  static initialize(): void {
    this.createAnnouncementRegion();
    this.setupKeyboardNavigation();
    this.setupFocusManagement();
  }

  /**
   * Announce message to screen readers
   */
  static announce(
    message: string, 
    priority: 'polite' | 'assertive' = 'polite',
    timeout: number = 3000
  ): void {
    const announcement: ScreenReaderAnnouncement = {
      message,
      priority,
      timeout
    };

    this.messageQueue.push(announcement);
    this.processMessageQueue();
  }

  /**
   * Announce form validation errors
   */
  static announceValidationErrors(errors: string[]): void {
    if (errors.length === 0) return;

    const message = errors.length === 1 
      ? `Valideringsfel: ${errors[0]}`
      : `${errors.length} valideringsfel: ${errors.join(', ')}`;

    this.announce(message, 'assertive');
  }

  /**
   * Announce page navigation
   */
  static announceNavigation(pageName: string, description?: string): void {
    const message = description 
      ? `Navigerade till ${pageName}. ${description}`
      : `Navigerade till ${pageName}`;

    this.announce(message, 'polite');
  }

  /**
   * Announce dynamic content changes
   */
  static announceContentChange(
    changeType: 'added' | 'removed' | 'updated',
    description: string
  ): void {
    const messages = {
      added: `Nytt innehåll tillagt: ${description}`,
      removed: `Innehåll borttaget: ${description}`,
      updated: `Innehåll uppdaterat: ${description}`
    };

    this.announce(messages[changeType], 'polite');
  }

  /**
   * Announce loading states
   */
  static announceLoading(isLoading: boolean, context?: string): void {
    const message = isLoading
      ? `Laddar${context ? ` ${context}` : ''}...`
      : `Laddning slutförd${context ? ` för ${context}` : ''}`;

    this.announce(message, 'polite');
  }

  /**
   * Create announcement region for screen readers
   */
  private static createAnnouncementRegion(): void {
    if (this.announcementRegion) return;

    this.announcementRegion = document.createElement('div');
    this.announcementRegion.setAttribute('aria-live', 'polite');
    this.announcementRegion.setAttribute('aria-atomic', 'true');
    this.announcementRegion.setAttribute('aria-relevant', 'text');
    this.announcementRegion.className = 'sr-only';
    this.announcementRegion.id = 'screen-reader-announcements';

    document.body.appendChild(this.announcementRegion);
  }

  /**
   * Process message queue
   */
  private static async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0) {
      const announcement = this.messageQueue.shift()!;
      await this.processAnnouncement(announcement);
    }

    this.isProcessingQueue = false;
  }

  /**
   * Process individual announcement
   */
  private static async processAnnouncement(announcement: ScreenReaderAnnouncement): Promise<void> {
    if (!this.announcementRegion) return;

    // Clear previous message
    this.announcementRegion.textContent = '';
    this.announcementRegion.setAttribute('aria-live', announcement.priority);

    // Small delay to ensure screen reader notices the change
    await new Promise(resolve => setTimeout(resolve, 100));

    // Set new message
    this.announcementRegion.textContent = announcement.message;

    // Clear message after timeout
    if (announcement.timeout) {
      setTimeout(() => {
        if (this.announcementRegion) {
          this.announcementRegion.textContent = '';
        }
      }, announcement.timeout);
    }

    // Delay between messages
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Setup keyboard navigation
   */
  private static setupKeyboardNavigation(): void {
    // Add skip links
    this.addSkipLinks();

    // Setup keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      this.handleKeyboardShortcuts(event);
    });

    // Enhance focus indicators
    document.addEventListener('focusin', (event) => {
      this.enhanceFocusIndicator(event.target as HTMLElement);
    });

    document.addEventListener('focusout', (event) => {
      this.removeFocusIndicator(event.target as HTMLElement);
    });
  }

  /**
   * Add skip links to page
   */
  private static addSkipLinks(): void {
    const skipLinks = document.createElement('div');
    skipLinks.className = 'skip-links';
    skipLinks.innerHTML = `
      <a href="#main-content" class="skip-link">Hoppa till huvudinnehåll</a>
      <a href="#navigation" class="skip-link">Hoppa till navigation</a>
      <a href="#search" class="skip-link">Hoppa till sökning</a>
    `;

    document.body.insertBefore(skipLinks, document.body.firstChild);

    // Style skip links
    const style = document.createElement('style');
    style.textContent = `
      .skip-links {
        position: absolute;
        top: -40px;
        left: 6px;
        z-index: 1000;
      }
      
      .skip-link {
        position: absolute;
        left: -10000px;
        top: auto;
        width: 1px;
        height: 1px;
        overflow: hidden;
        background: #000;
        color: #fff;
        padding: 8px 16px;
        text-decoration: none;
        border-radius: 4px;
        font-size: 14px;
      }
      
      .skip-link:focus {
        position: static;
        width: auto;
        height: auto;
        left: auto;
        top: auto;
        overflow: visible;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Handle keyboard shortcuts
   */
  private static handleKeyboardShortcuts(event: KeyboardEvent): void {
    // Skip if in form field
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    // Alt + H = Go to homepage
    if (event.altKey && event.key === 'h') {
      event.preventDefault();
      window.location.href = '/';
      this.announce('Navigerar till startsidan');
    }

    // Alt + M = Go to main content
    if (event.altKey && event.key === 'm') {
      event.preventDefault();
      const main = document.getElementById('main-content') || document.querySelector('main');
      if (main) {
        (main as HTMLElement).focus();
        this.announce('Hoppar till huvudinnehåll');
      }
    }

    // Alt + N = Go to navigation
    if (event.altKey && event.key === 'n') {
      event.preventDefault();
      const nav = document.getElementById('navigation') || document.querySelector('nav');
      if (nav) {
        (nav as HTMLElement).focus();
        this.announce('Hoppar till navigation');
      }
    }

    // Alt + S = Go to search
    if (event.altKey && event.key === 's') {
      event.preventDefault();
      const search = document.getElementById('search') || document.querySelector('[role="search"]');
      if (search) {
        (search as HTMLElement).focus();
        this.announce('Hoppar till sökning');
      }
    }
  }

  /**
   * Enhance focus indicator
   */
  private static enhanceFocusIndicator(element: HTMLElement): void {
    if (!element) return;

    element.classList.add('enhanced-focus');
    
    // Announce focus change
    const label = this.getElementLabel(element);
    if (label) {
      this.announce(`Fokus på ${label}`, 'polite', 1000);
    }
  }

  /**
   * Remove focus indicator
   */
  private static removeFocusIndicator(element: HTMLElement): void {
    if (!element) return;
    element.classList.remove('enhanced-focus');
  }

  /**
   * Get accessible label for element
   */
  private static getElementLabel(element: HTMLElement): string | null {
    // Check various label sources in order of preference
    const label = element.getAttribute('aria-label') ||
                 element.getAttribute('aria-labelledby') ||
                 element.getAttribute('title') ||
                 element.getAttribute('alt') ||
                 element.textContent?.trim() ||
                 element.getAttribute('placeholder');

    return label || null;
  }

  /**
   * Setup focus management
   */
  private static setupFocusManagement(): void {
    // Trap focus in modals
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') {
        this.handleFocusTrapping(event);
      }
    });

    // Restore focus after modal closes
    let lastFocusedElement: HTMLElement | null = null;
    
    document.addEventListener('focusin', (event) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[role="dialog"]') && !target.closest('.modal')) {
        lastFocusedElement = target;
      }
    });

    // Listen for modal events to restore focus
    document.addEventListener('modal-closed', () => {
      if (lastFocusedElement) {
        lastFocusedElement.focus();
        lastFocusedElement = null;
      }
    });
  }

  /**
   * Handle focus trapping in modals
   */
  private static handleFocusTrapping(event: KeyboardEvent): void {
    const modal = document.querySelector('[role="dialog"]:not([aria-hidden="true"])') ||
                 document.querySelector('.modal:not([aria-hidden="true"])');
    
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }
}

/**
 * ARIA Helper Functions
 */
export const AriaHelpers = {
  /**
   * Set up proper ARIA attributes for form fields
   */
  setupFormField(input: HTMLElement, labelText: string, errorId?: string, descriptionId?: string): void {
    // Ensure input has proper labeling
    if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
      input.setAttribute('aria-label', labelText);
    }

    // Link to error message
    if (errorId) {
      const describedBy = input.getAttribute('aria-describedby') || '';
      const ids = describedBy.split(' ').filter(id => id);
      if (!ids.includes(errorId)) {
        ids.push(errorId);
        input.setAttribute('aria-describedby', ids.join(' '));
      }
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }

    // Link to description
    if (descriptionId) {
      const describedBy = input.getAttribute('aria-describedby') || '';
      const ids = describedBy.split(' ').filter(id => id);
      if (!ids.includes(descriptionId)) {
        ids.push(descriptionId);
        input.setAttribute('aria-describedby', ids.join(' '));
      }
    }
  },

  /**
   * Setup ARIA for progress indicators
   */
  setupProgress(element: HTMLElement, current: number, total: number, label?: string): void {
    element.setAttribute('role', 'progressbar');
    element.setAttribute('aria-valuenow', current.toString());
    element.setAttribute('aria-valuemin', '0');
    element.setAttribute('aria-valuemax', total.toString());
    
    if (label) {
      element.setAttribute('aria-label', label);
    }

    const percentage = Math.round((current / total) * 100);
    element.setAttribute('aria-valuetext', `${percentage}% slutfört`);
  },

  /**
   * Setup ARIA for dynamic content
   */
  setupLiveRegion(element: HTMLElement, level: 'polite' | 'assertive' = 'polite'): void {
    element.setAttribute('aria-live', level);
    element.setAttribute('aria-atomic', 'true');
    element.setAttribute('aria-relevant', 'additions text');
  },

  /**
   * Setup ARIA for expandable content
   */
  setupExpandable(
    trigger: HTMLElement, 
    content: HTMLElement, 
    isExpanded: boolean = false
  ): void {
    const contentId = content.id || `expandable-${Date.now()}`;
    content.id = contentId;

    trigger.setAttribute('aria-expanded', isExpanded.toString());
    trigger.setAttribute('aria-controls', contentId);

    content.setAttribute('aria-hidden', (!isExpanded).toString());

    // Add click handler
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      const newState = !expanded;
      
      trigger.setAttribute('aria-expanded', newState.toString());
      content.setAttribute('aria-hidden', (!newState).toString());
      
      ScreenReaderSupport.announce(
        newState ? 'Innehåll expanderat' : 'Innehåll kollapserat'
      );
    });
  },

  /**
   * Setup ARIA for dialogs/modals
   */
  setupDialog(dialog: HTMLElement, title: string, description?: string): void {
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', title);
    
    if (description) {
      const descId = `dialog-desc-${Date.now()}`;
      const descElement = document.createElement('div');
      descElement.id = descId;
      descElement.textContent = description;
      descElement.className = 'sr-only';
      
      dialog.appendChild(descElement);
      dialog.setAttribute('aria-describedby', descId);
    }

    // Focus management
    const focusableElements = dialog.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }
  }
};

/**
 * Color Contrast Utilities
 */
export const ColorContrast = {
  /**
   * Calculate relative luminance of a color
   */
  getRelativeLuminance(hex: string): number {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return 0;

    const [r, g, b] = rgb.map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  },

  /**
   * Calculate contrast ratio between two colors
   */
  getContrastRatio(color1: string, color2: string): number {
    const l1 = this.getRelativeLuminance(color1);
    const l2 = this.getRelativeLuminance(color2);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  },

  /**
   * Check if contrast ratio meets WCAG requirements
   */
  meetsWCAG(color1: string, color2: string, level: 'AA' | 'AAA' = 'AA', size: 'normal' | 'large' = 'normal'): boolean {
    const ratio = this.getContrastRatio(color1, color2);
    
    const requirements = {
      'AA': { normal: 4.5, large: 3 },
      'AAA': { normal: 7, large: 4.5 }
    };
    
    return ratio >= requirements[level][size];
  },

  /**
   * Convert hex color to RGB
   */
  hexToRgb(hex: string): [number, number, number] | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : null;
  }
};

/**
 * Text Readability Utilities
 */
export const TextReadability = {
  /**
   * Calculate Flesch Reading Ease score
   */
  getFleschScore(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    const syllables = this.countSyllables(text);

    if (sentences === 0 || words === 0) return 0;

    const avgSentenceLength = words / sentences;
    const avgSyllablesPerWord = syllables / words;

    return 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  },

  /**
   * Get reading level based on Flesch score
   */
  getReadingLevel(score: number): string {
    if (score >= 90) return 'Mycket lätt';
    if (score >= 80) return 'Lätt';
    if (score >= 70) return 'Ganska lätt';
    if (score >= 60) return 'Standard';
    if (score >= 50) return 'Ganska svår';
    if (score >= 30) return 'Svår';
    return 'Mycket svår';
  },

  /**
   * Count syllables in text (Swedish approximation)
   */
  countSyllables(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    let totalSyllables = 0;

    for (const word of words) {
      // Swedish vowels
      const vowels = 'aeiouyåäö';
      let syllables = 0;
      let previousWasVowel = false;

      for (let i = 0; i < word.length; i++) {
        const isVowel = vowels.includes(word[i]);
        if (isVowel && !previousWasVowel) {
          syllables++;
        }
        previousWasVowel = isVowel;
      }

      // Minimum one syllable per word
      totalSyllables += Math.max(syllables, 1);
    }

    return totalSyllables;
  },

  /**
   * Suggest text improvements for readability
   */
  getSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    const score = this.getFleschScore(text);
    
    if (score < 60) {
      suggestions.push('Använd kortare meningar för bättre läsbarhet');
      suggestions.push('Byt ut komplexa ord mot enklare alternativ');
    }
    
    if (score < 40) {
      suggestions.push('Texten är mycket svår att läsa - överväg omskrivning');
    }

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = text.split(/\s+/).length / sentences.length;
    
    if (avgSentenceLength > 20) {
      suggestions.push('Meningarna är för långa - dela upp dem i kortare stycken');
    }

    return suggestions;
  }
};

// Initialize screen reader support when module loads
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    ScreenReaderSupport.initialize();
  });
}

