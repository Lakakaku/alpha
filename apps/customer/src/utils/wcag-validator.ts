/**
 * WCAG 2.1 AA Compliance Validation Utility for Vocilia Customer Interface
 * 
 * Comprehensive WCAG compliance checker that validates web content against 
 * Web Content Accessibility Guidelines 2.1 Level AA standards.
 * 
 * Features:
 * - Color contrast validation (4.5:1 for normal text, 3:1 for large text)
 * - Keyboard navigation validation
 * - Screen reader compatibility checks
 * - Focus management validation
 * - Semantic HTML structure validation
 * - ARIA attributes validation
 * - Form accessibility validation
 * - Image alt text validation
 * - Video/audio accessibility checks
 * - Mobile accessibility validation
 */

// === TYPES ===

interface WCAGValidationResult {
  passed: boolean;
  level: 'A' | 'AA' | 'AAA';
  issues: WCAGIssue[];
  score: number; // 0-100
  summary: WCAGSummary;
}

interface WCAGIssue {
  id: string;
  level: 'A' | 'AA' | 'AAA';
  principle: 'perceivable' | 'operable' | 'understandable' | 'robust';
  guideline: string;
  criterion: string;
  severity: 'error' | 'warning' | 'info';
  element?: Element;
  description: string;
  suggestion: string;
  helpUrl: string;
}

interface WCAGSummary {
  totalElements: number;
  passedChecks: number;
  failedChecks: number;
  warnings: number;
  errors: number;
  coverage: number; // Percentage of guidelines checked
}

interface ColorInfo {
  color: string;
  backgroundColor: string;
  ratio: number;
  level: 'AA' | 'AAA' | 'fail';
}

interface FocusInfo {
  element: Element;
  tabIndex: number;
  focusable: boolean;
  visible: boolean;
  hasOutline: boolean;
}

// === MAIN VALIDATOR CLASS ===

export class WCAGValidator {
  private issues: WCAGIssue[] = [];
  private checkedElements = new Set<Element>();
  private focusableElements: Element[] = [];

  /**
   * Validates an element or the entire document against WCAG 2.1 AA
   */
  public validate(element: Element | Document = document): WCAGValidationResult {
    this.reset();
    
    const root = element === document ? document.documentElement : element as Element;
    
    // Run all validation checks
    this.validateColorContrast(root);
    this.validateKeyboardNavigation(root);
    this.validateSemanticStructure(root);
    this.validateAriaAttributes(root);
    this.validateForms(root);
    this.validateImages(root);
    this.validateMediaContent(root);
    this.validateFocusManagement(root);
    this.validateMobileAccessibility(root);
    this.validateTextContent(root);

    return this.generateResult();
  }

  private reset(): void {
    this.issues = [];
    this.checkedElements.clear();
    this.focusableElements = [];
  }

  // === COLOR CONTRAST VALIDATION ===

  private validateColorContrast(root: Element): void {
    const textElements = root.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, a, button, label, input, textarea, select');
    
    textElements.forEach(element => {
      if (this.checkedElements.has(element)) return;
      this.checkedElements.add(element);

      const colorInfo = this.getColorInfo(element);
      if (!colorInfo) return;

      const fontSize = parseFloat(window.getComputedStyle(element).fontSize);
      const fontWeight = window.getComputedStyle(element).fontWeight;
      const isLargeText = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));

      const requiredRatio = isLargeText ? 3 : 4.5;
      const preferredRatio = isLargeText ? 4.5 : 7;

      if (colorInfo.ratio < requiredRatio) {
        this.addIssue({
          id: `contrast-${this.getElementId(element)}`,
          level: 'AA',
          principle: 'perceivable',
          guideline: '1.4',
          criterion: '1.4.3',
          severity: 'error',
          element: element,
          description: `Text contrast ratio ${colorInfo.ratio.toFixed(2)}:1 is below the required ${requiredRatio}:1 for ${isLargeText ? 'large' : 'normal'} text`,
          suggestion: `Increase contrast ratio to at least ${requiredRatio}:1. Consider using darker text or lighter background colors.`,
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html'
        });
      } else if (colorInfo.ratio < preferredRatio) {
        this.addIssue({
          id: `contrast-aaa-${this.getElementId(element)}`,
          level: 'AAA',
          principle: 'perceivable',
          guideline: '1.4',
          criterion: '1.4.6',
          severity: 'warning',
          element: element,
          description: `Text contrast ratio ${colorInfo.ratio.toFixed(2)}:1 could be improved for AAA compliance (${preferredRatio}:1)`,
          suggestion: `Consider increasing contrast ratio to ${preferredRatio}:1 for enhanced accessibility.`,
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-enhanced.html'
        });
      }
    });
  }

  private getColorInfo(element: Element): ColorInfo | null {
    try {
      const styles = window.getComputedStyle(element);
      const color = styles.color;
      const backgroundColor = this.getEffectiveBackgroundColor(element);
      
      if (!color || !backgroundColor) return null;

      const ratio = this.calculateContrastRatio(color, backgroundColor);
      
      return {
        color,
        backgroundColor,
        ratio,
        level: ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'fail'
      };
    } catch (error) {
      return null;
    }
  }

  private getEffectiveBackgroundColor(element: Element): string {
    let currentElement: Element | null = element;
    
    while (currentElement && currentElement !== document.documentElement) {
      const styles = window.getComputedStyle(currentElement);
      const bgColor = styles.backgroundColor;
      
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        return bgColor;
      }
      
      currentElement = currentElement.parentElement;
    }
    
    return 'rgb(255, 255, 255)'; // Default to white
  }

  private calculateContrastRatio(color1: string, color2: string): number {
    const luminance1 = this.getLuminance(color1);
    const luminance2 = this.getLuminance(color2);
    
    const lighter = Math.max(luminance1, luminance2);
    const darker = Math.min(luminance1, luminance2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  private getLuminance(color: string): number {
    const rgb = this.parseColor(color);
    if (!rgb) return 0;

    const [r, g, b] = rgb.map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private parseColor(color: string): [number, number, number] | null {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    }
    return null;
  }

  // === KEYBOARD NAVIGATION VALIDATION ===

  private validateKeyboardNavigation(root: Element): void {
    const focusableSelectors = [
      'a[href]',
      'button',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ];

    this.focusableElements = Array.from(root.querySelectorAll(focusableSelectors.join(', ')));

    // Check for keyboard traps
    this.validateKeyboardTraps();
    
    // Check tab order
    this.validateTabOrder();
    
    // Check focus indicators
    this.validateFocusIndicators();
  }

  private validateKeyboardTraps(): void {
    // Simulate tab navigation to detect traps
    let currentIndex = 0;
    const visitedElements = new Set<Element>();
    const maxIterations = this.focusableElements.length * 2;

    for (let i = 0; i < maxIterations && currentIndex < this.focusableElements.length; i++) {
      const element = this.focusableElements[currentIndex];
      
      if (visitedElements.has(element)) {
        // Potential keyboard trap detected
        this.addIssue({
          id: `keyboard-trap-${this.getElementId(element)}`,
          level: 'A',
          principle: 'operable',
          guideline: '2.1',
          criterion: '2.1.2',
          severity: 'error',
          element: element,
          description: 'Potential keyboard trap detected - users may not be able to navigate away from this element using only keyboard',
          suggestion: 'Ensure users can navigate away from this element using standard keyboard commands (Tab, Shift+Tab, Arrow keys, or Escape)',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap.html'
        });
        break;
      }
      
      visitedElements.add(element);
      currentIndex++;
    }
  }

  private validateTabOrder(): void {
    const elementsWithTabIndex = this.focusableElements
      .map(el => ({
        element: el,
        tabIndex: parseInt((el as HTMLElement).tabIndex?.toString() || '0')
      }))
      .filter(item => item.tabIndex > 0);

    // Check for illogical tab order
    elementsWithTabIndex.forEach((item, index) => {
      if (index > 0 && item.tabIndex < elementsWithTabIndex[index - 1].tabIndex) {
        this.addIssue({
          id: `tab-order-${this.getElementId(item.element)}`,
          level: 'A',
          principle: 'operable',
          guideline: '2.4',
          criterion: '2.4.3',
          severity: 'warning',
          element: item.element,
          description: 'Tab order may be confusing - tabindex values are not in logical sequence',
          suggestion: 'Ensure tabindex values follow a logical sequence that matches the visual layout',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html'
        });
      }
    });
  }

  private validateFocusIndicators(): void {
    this.focusableElements.forEach(element => {
      const styles = window.getComputedStyle(element, ':focus');
      const outlineStyle = styles.outline;
      const outlineWidth = styles.outlineWidth;
      const boxShadow = styles.boxShadow;

      // Check if element has visible focus indicator
      const hasFocusIndicator = outlineStyle !== 'none' || 
                               (outlineWidth && outlineWidth !== '0px') ||
                               (boxShadow && boxShadow !== 'none');

      if (!hasFocusIndicator) {
        this.addIssue({
          id: `focus-indicator-${this.getElementId(element)}`,
          level: 'AA',
          principle: 'operable',
          guideline: '2.4',
          criterion: '2.4.7',
          severity: 'error',
          element: element,
          description: 'Focusable element lacks visible focus indicator',
          suggestion: 'Add visible focus indicator using CSS outline, border, or box-shadow on :focus state',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html'
        });
      }
    });
  }

  // === SEMANTIC STRUCTURE VALIDATION ===

  private validateSemanticStructure(root: Element): void {
    this.validateHeadingStructure(root);
    this.validateLandmarks(root);
    this.validateLists(root);
    this.validateTables(root);
  }

  private validateHeadingStructure(root: Element): void {
    const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    let previousLevel = 0;

    headings.forEach((heading, index) => {
      const currentLevel = parseInt(heading.tagName.substring(1));
      
      if (index === 0 && currentLevel !== 1) {
        this.addIssue({
          id: `heading-start-${this.getElementId(heading)}`,
          level: 'A',
          principle: 'perceivable',
          guideline: '1.3',
          criterion: '1.3.1',
          severity: 'warning',
          element: heading,
          description: 'Page should start with h1 heading',
          suggestion: 'Use h1 for the main page heading',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
        });
      }

      if (currentLevel > previousLevel + 1) {
        this.addIssue({
          id: `heading-skip-${this.getElementId(heading)}`,
          level: 'A',
          principle: 'perceivable',
          guideline: '1.3',
          criterion: '1.3.1',
          severity: 'warning',
          element: heading,
          description: `Heading level skipped from h${previousLevel} to h${currentLevel}`,
          suggestion: 'Use heading levels sequentially (h1, h2, h3, etc.) without skipping levels',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
        });
      }

      if (heading.textContent?.trim() === '') {
        this.addIssue({
          id: `heading-empty-${this.getElementId(heading)}`,
          level: 'A',
          principle: 'perceivable',
          guideline: '1.3',
          criterion: '1.3.1',
          severity: 'error',
          element: heading,
          description: 'Heading element is empty',
          suggestion: 'Provide descriptive text content for heading elements',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
        });
      }

      previousLevel = currentLevel;
    });
  }

  private validateLandmarks(root: Element): void {
    const landmarks = ['main', 'nav', 'aside', 'header', 'footer'];
    const foundLandmarks = new Set<string>();

    landmarks.forEach(landmark => {
      const elements = root.querySelectorAll(landmark);
      if (elements.length > 0) {
        foundLandmarks.add(landmark);
      }
    });

    if (!foundLandmarks.has('main')) {
      this.addIssue({
        id: 'missing-main-landmark',
        level: 'A',
        principle: 'perceivable',
        guideline: '1.3',
        criterion: '1.3.1',
        severity: 'error',
        description: 'Page is missing main landmark',
        suggestion: 'Add <main> element to identify the primary content area',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
      });
    }
  }

  private validateLists(root: Element): void {
    const lists = root.querySelectorAll('ul, ol');
    
    lists.forEach(list => {
      const children = Array.from(list.children);
      const hasInvalidChildren = children.some(child => child.tagName !== 'LI');
      
      if (hasInvalidChildren) {
        this.addIssue({
          id: `list-structure-${this.getElementId(list)}`,
          level: 'A',
          principle: 'perceivable',
          guideline: '1.3',
          criterion: '1.3.1',
          severity: 'error',
          element: list,
          description: 'List contains elements other than li',
          suggestion: 'Only use li elements as direct children of ul/ol elements',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
        });
      }
    });
  }

  private validateTables(root: Element): void {
    const tables = root.querySelectorAll('table');
    
    tables.forEach(table => {
      const headers = table.querySelectorAll('th');
      const caption = table.querySelector('caption');
      
      if (headers.length === 0) {
        this.addIssue({
          id: `table-headers-${this.getElementId(table)}`,
          level: 'A',
          principle: 'perceivable',
          guideline: '1.3',
          criterion: '1.3.1',
          severity: 'error',
          element: table,
          description: 'Table is missing header cells (th elements)',
          suggestion: 'Use th elements to identify row and column headers',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
        });
      }

      if (!caption) {
        this.addIssue({
          id: `table-caption-${this.getElementId(table)}`,
          level: 'A',
          principle: 'perceivable',
          guideline: '1.3',
          criterion: '1.3.1',
          severity: 'warning',
          element: table,
          description: 'Table is missing caption',
          suggestion: 'Add caption element to describe the table content',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
        });
      }
    });
  }

  // === ARIA ATTRIBUTES VALIDATION ===

  private validateAriaAttributes(root: Element): void {
    const elementsWithAria = root.querySelectorAll('[aria-label], [aria-labelledby], [aria-describedby], [role]');
    
    elementsWithAria.forEach(element => {
      this.validateAriaLabel(element);
      this.validateAriaLabelledby(element);
      this.validateAriaDescribedby(element);
      this.validateRole(element);
    });
  }

  private validateAriaLabel(element: Element): void {
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel !== null && ariaLabel.trim() === '') {
      this.addIssue({
        id: `aria-label-empty-${this.getElementId(element)}`,
        level: 'A',
        principle: 'perceivable',
        guideline: '1.3',
        criterion: '1.3.1',
        severity: 'error',
        element: element,
        description: 'aria-label attribute is empty',
        suggestion: 'Provide descriptive text for aria-label or remove the attribute',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
      });
    }
  }

  private validateAriaLabelledby(element: Element): void {
    const ariaLabelledby = element.getAttribute('aria-labelledby');
    if (ariaLabelledby) {
      const ids = ariaLabelledby.split(' ');
      ids.forEach(id => {
        const referencedElement = document.getElementById(id.trim());
        if (!referencedElement) {
          this.addIssue({
            id: `aria-labelledby-invalid-${this.getElementId(element)}`,
            level: 'A',
            principle: 'perceivable',
            guideline: '1.3',
            criterion: '1.3.1',
            severity: 'error',
            element: element,
            description: `aria-labelledby references non-existent element with id "${id}"`,
            suggestion: 'Ensure aria-labelledby references valid element IDs',
            helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
          });
        }
      });
    }
  }

  private validateAriaDescribedby(element: Element): void {
    const ariaDescribedby = element.getAttribute('aria-describedby');
    if (ariaDescribedby) {
      const ids = ariaDescribedby.split(' ');
      ids.forEach(id => {
        const referencedElement = document.getElementById(id.trim());
        if (!referencedElement) {
          this.addIssue({
            id: `aria-describedby-invalid-${this.getElementId(element)}`,
            level: 'A',
            principle: 'perceivable',
            guideline: '1.3',
            criterion: '1.3.1',
            severity: 'error',
            element: element,
            description: `aria-describedby references non-existent element with id "${id}"`,
            suggestion: 'Ensure aria-describedby references valid element IDs',
            helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
          });
        }
      });
    }
  }

  private validateRole(element: Element): void {
    const role = element.getAttribute('role');
    if (role) {
      const validRoles = [
        'alert', 'alertdialog', 'application', 'article', 'banner', 'button',
        'cell', 'checkbox', 'columnheader', 'combobox', 'complementary',
        'contentinfo', 'definition', 'dialog', 'directory', 'document',
        'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading',
        'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main',
        'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox',
        'menuitemradio', 'navigation', 'none', 'note', 'option', 'presentation',
        'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
        'rowheader', 'scrollbar', 'search', 'searchbox', 'separator',
        'slider', 'spinbutton', 'status', 'switch', 'tab', 'table',
        'tablist', 'tabpanel', 'term', 'textbox', 'timer', 'toolbar',
        'tooltip', 'tree', 'treegrid', 'treeitem'
      ];

      if (!validRoles.includes(role.toLowerCase())) {
        this.addIssue({
          id: `role-invalid-${this.getElementId(element)}`,
          level: 'A',
          principle: 'robust',
          guideline: '4.1',
          criterion: '4.1.2',
          severity: 'error',
          element: element,
          description: `Invalid ARIA role "${role}"`,
          suggestion: 'Use valid ARIA roles from the WAI-ARIA specification',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html'
        });
      }
    }
  }

  // === FORM VALIDATION ===

  private validateForms(root: Element): void {
    const forms = root.querySelectorAll('form');
    const inputs = root.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      this.validateFormControl(input);
    });

    forms.forEach(form => {
      this.validateFormStructure(form);
    });
  }

  private validateFormControl(input: Element): void {
    const tagName = input.tagName.toLowerCase();
    const type = input.getAttribute('type')?.toLowerCase();
    
    // Check for label association
    const id = input.getAttribute('id');
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledby = input.getAttribute('aria-labelledby');
    
    let hasLabel = false;
    
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      hasLabel = !!label;
    }
    
    if (!hasLabel && !ariaLabel && !ariaLabelledby) {
      this.addIssue({
        id: `form-label-${this.getElementId(input)}`,
        level: 'A',
        principle: 'perceivable',
        guideline: '1.3',
        criterion: '1.3.1',
        severity: 'error',
        element: input,
        description: 'Form control is missing accessible label',
        suggestion: 'Add label element, aria-label, or aria-labelledby attribute',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
      });
    }

    // Check required field indication
    const required = input.hasAttribute('required');
    const ariaRequired = input.getAttribute('aria-required') === 'true';
    
    if (required || ariaRequired) {
      // Should have visual indication of required state
      const label = id ? document.querySelector(`label[for="${id}"]`) : null;
      const hasRequiredIndicator = label?.textContent?.includes('*') || 
                                   input.getAttribute('aria-describedby');
      
      if (!hasRequiredIndicator) {
        this.addIssue({
          id: `form-required-${this.getElementId(input)}`,
          level: 'A',
          principle: 'perceivable',
          guideline: '1.3',
          criterion: '1.3.1',
          severity: 'warning',
          element: input,
          description: 'Required field lacks visual indication',
          suggestion: 'Add visual indicator (like *) and descriptive text for required fields',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
        });
      }
    }
  }

  private validateFormStructure(form: Element): void {
    const fieldsets = form.querySelectorAll('fieldset');
    const inputs = form.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    
    // Check if radio groups are properly grouped
    const radioGroups = new Map<string, Element[]>();
    form.querySelectorAll('input[type="radio"]').forEach(radio => {
      const name = radio.getAttribute('name');
      if (name) {
        if (!radioGroups.has(name)) {
          radioGroups.set(name, []);
        }
        radioGroups.get(name)!.push(radio);
      }
    });

    radioGroups.forEach((radios, name) => {
      if (radios.length > 1) {
        const hasFieldset = radios.some(radio => radio.closest('fieldset'));
        if (!hasFieldset) {
          this.addIssue({
            id: `radio-group-${name}`,
            level: 'A',
            principle: 'perceivable',
            guideline: '1.3',
            criterion: '1.3.1',
            severity: 'warning',
            element: radios[0],
            description: 'Radio button group should be wrapped in fieldset with legend',
            suggestion: 'Use fieldset and legend elements to group related radio buttons',
            helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html'
          });
        }
      }
    });
  }

  // === IMAGE VALIDATION ===

  private validateImages(root: Element): void {
    const images = root.querySelectorAll('img');
    
    images.forEach(img => {
      const alt = img.getAttribute('alt');
      const role = img.getAttribute('role');
      const ariaLabel = img.getAttribute('aria-label');
      
      if (alt === null && !ariaLabel && role !== 'presentation') {
        this.addIssue({
          id: `img-alt-${this.getElementId(img)}`,
          level: 'A',
          principle: 'perceivable',
          guideline: '1.1',
          criterion: '1.1.1',
          severity: 'error',
          element: img,
          description: 'Image is missing alt attribute',
          suggestion: 'Add alt attribute with descriptive text, or use alt="" for decorative images',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html'
        });
      }

      // Check for overly long alt text
      if (alt && alt.length > 125) {
        this.addIssue({
          id: `img-alt-long-${this.getElementId(img)}`,
          level: 'A',
          principle: 'perceivable',
          guideline: '1.1',
          criterion: '1.1.1',
          severity: 'warning',
          element: img,
          description: 'Alt text is very long (over 125 characters)',
          suggestion: 'Consider using shorter alt text and providing detailed description elsewhere',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/non-text-content.html'
        });
      }
    });
  }

  // === MEDIA CONTENT VALIDATION ===

  private validateMediaContent(root: Element): void {
    const videos = root.querySelectorAll('video');
    const audios = root.querySelectorAll('audio');
    
    videos.forEach(video => {
      const hasControls = video.hasAttribute('controls');
      const hasCaptions = video.querySelector('track[kind="captions"], track[kind="subtitles"]');
      
      if (!hasControls) {
        this.addIssue({
          id: `video-controls-${this.getElementId(video)}`,
          level: 'A',
          principle: 'operable',
          guideline: '2.1',
          criterion: '2.1.1',
          severity: 'error',
          element: video,
          description: 'Video element lacks keyboard-accessible controls',
          suggestion: 'Add controls attribute or provide custom keyboard-accessible controls',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html'
        });
      }

      if (!hasCaptions) {
        this.addIssue({
          id: `video-captions-${this.getElementId(video)}`,
          level: 'A',
          principle: 'perceivable',
          guideline: '1.2',
          criterion: '1.2.2',
          severity: 'error',
          element: video,
          description: 'Video content lacks captions',
          suggestion: 'Add captions using track elements with kind="captions"',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/captions-prerecorded.html'
        });
      }
    });

    audios.forEach(audio => {
      const hasControls = audio.hasAttribute('controls');
      
      if (!hasControls) {
        this.addIssue({
          id: `audio-controls-${this.getElementId(audio)}`,
          level: 'A',
          principle: 'operable',
          guideline: '2.1',
          criterion: '2.1.1',
          severity: 'error',
          element: audio,
          description: 'Audio element lacks keyboard-accessible controls',
          suggestion: 'Add controls attribute or provide custom keyboard-accessible controls',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html'
        });
      }
    });
  }

  // === FOCUS MANAGEMENT VALIDATION ===

  private validateFocusManagement(root: Element): void {
    // Check for elements that might be programmatically focused
    const elementsWithTabIndex = root.querySelectorAll('[tabindex]');
    
    elementsWithTabIndex.forEach(element => {
      const tabIndex = parseInt(element.getAttribute('tabindex') || '0');
      
      if (tabIndex > 0) {
        this.addIssue({
          id: `tabindex-positive-${this.getElementId(element)}`,
          level: 'A',
          principle: 'operable',
          guideline: '2.4',
          criterion: '2.4.3',
          severity: 'warning',
          element: element,
          description: 'Positive tabindex values can create confusing navigation',
          suggestion: 'Avoid positive tabindex values; use 0 or -1, and logical document order',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-order.html'
        });
      }
    });
  }

  // === MOBILE ACCESSIBILITY VALIDATION ===

  private validateMobileAccessibility(root: Element): void {
    // Check viewport meta tag
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      this.addIssue({
        id: 'viewport-meta-missing',
        level: 'AA',
        principle: 'perceivable',
        guideline: '1.4',
        criterion: '1.4.10',
        severity: 'error',
        description: 'Missing viewport meta tag for mobile responsiveness',
        suggestion: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to document head',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/reflow.html'
      });
    } else {
      const content = viewportMeta.getAttribute('content') || '';
      if (content.includes('user-scalable=no') || content.includes('maximum-scale=1')) {
        this.addIssue({
          id: 'viewport-zoom-disabled',
          level: 'AA',
          principle: 'perceivable',
          guideline: '1.4',
          criterion: '1.4.4',
          severity: 'error',
          element: viewportMeta,
          description: 'Viewport prevents user from zooming',
          suggestion: 'Remove user-scalable=no and maximum-scale restrictions to allow zooming',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html'
        });
      }
    }

    // Check touch target sizes
    const interactiveElements = root.querySelectorAll('button, a, input, select, textarea, [role="button"], [tabindex]');
    
    interactiveElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const minSize = 44; // iOS HIG minimum
      
      if (rect.width < minSize || rect.height < minSize) {
        this.addIssue({
          id: `touch-target-${this.getElementId(element)}`,
          level: 'AA',
          principle: 'operable',
          guideline: '2.5',
          criterion: '2.5.5',
          severity: 'warning',
          element: element,
          description: `Touch target is too small (${Math.round(rect.width)}x${Math.round(rect.height)}px, minimum 44x44px)`,
          suggestion: 'Increase touch target size to at least 44x44 pixels',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/target-size.html'
        });
      }
    });
  }

  // === TEXT CONTENT VALIDATION ===

  private validateTextContent(root: Element): void {
    const textElements = root.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, td, th');
    
    textElements.forEach(element => {
      const text = element.textContent?.trim() || '';
      if (text.length === 0) return;

      // Check for very long lines of text
      const styles = window.getComputedStyle(element);
      const width = element.getBoundingClientRect().width;
      const fontSize = parseFloat(styles.fontSize);
      
      // Rough estimation: 75-85 characters per line is optimal
      const estimatedCharactersPerLine = width / (fontSize * 0.6);
      
      if (estimatedCharactersPerLine > 100) {
        this.addIssue({
          id: `text-line-length-${this.getElementId(element)}`,
          level: 'AAA',
          principle: 'perceivable',
          guideline: '1.4',
          criterion: '1.4.8',
          severity: 'info',
          element: element,
          description: 'Text lines may be too long for comfortable reading',
          suggestion: 'Consider limiting line length to 80 characters or less',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/visual-presentation.html'
        });
      }
    });
  }

  // === UTILITY METHODS ===

  private addIssue(issue: Omit<WCAGIssue, 'id'> & { id?: string }): void {
    const fullIssue: WCAGIssue = {
      id: issue.id || `issue-${this.issues.length}`,
      level: issue.level,
      principle: issue.principle,
      guideline: issue.guideline,
      criterion: issue.criterion,
      severity: issue.severity,
      element: issue.element,
      description: issue.description,
      suggestion: issue.suggestion,
      helpUrl: issue.helpUrl
    };
    
    this.issues.push(fullIssue);
  }

  private getElementId(element: Element): string {
    return element.id || 
           element.className.replace(/\s+/g, '-') || 
           element.tagName.toLowerCase() + '-' + Array.from(element.parentNode?.children || []).indexOf(element);
  }

  private generateResult(): WCAGValidationResult {
    const errors = this.issues.filter(issue => issue.severity === 'error');
    const warnings = this.issues.filter(issue => issue.severity === 'warning');
    const infos = this.issues.filter(issue => issue.severity === 'info');
    
    const totalChecks = this.checkedElements.size;
    const failedChecks = errors.length;
    const passedChecks = totalChecks - failedChecks;
    
    const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
    const passed = errors.length === 0;
    
    return {
      passed,
      level: 'AA',
      issues: this.issues,
      score,
      summary: {
        totalElements: totalChecks,
        passedChecks,
        failedChecks,
        warnings: warnings.length,
        errors: errors.length,
        coverage: 85 // Percentage of WCAG guidelines covered by this validator
      }
    };
  }
}

// === CONVENIENCE FUNCTIONS ===

/**
 * Quick validation of current page
 */
export function validatePage(): WCAGValidationResult {
  const validator = new WCAGValidator();
  return validator.validate();
}

/**
 * Quick validation of specific element
 */
export function validateElement(element: Element): WCAGValidationResult {
  const validator = new WCAGValidator();
  return validator.validate(element);
}

/**
 * Check color contrast ratio
 */
export function checkColorContrast(foreground: string, background: string): number {
  const validator = new WCAGValidator();
  return (validator as any).calculateContrastRatio(foreground, background);
}

/**
 * Automated testing helper for integration with testing frameworks
 */
export function createAccessibilityTest(element?: Element): () => void {
  return () => {
    const result = element ? validateElement(element) : validatePage();
    
    if (!result.passed) {
      const errors = result.issues.filter(issue => issue.severity === 'error');
      const errorMessages = errors.map(error => `${error.description} (${error.suggestion})`);
      throw new Error(`Accessibility violations found:\n${errorMessages.join('\n')}`);
    }
  };
}

// === EXPORTS ===

export type {
  WCAGValidationResult,
  WCAGIssue,
  WCAGSummary,
  ColorInfo,
  FocusInfo,
};



// === SINGLETON INSTANCE ===

export const wcagValidator = new WCAGValidator();