/**
 * Unit Tests for Accessibility Utilities
 * 
 * Comprehensive test suite for accessibility utility functions and classes.
 * Tests screen reader support, ARIA helpers, color contrast, and text readability.
 */

import {
  ScreenReaderSupport,
  AriaHelpers,
  ColorContrast,
  TextReadability,
} from '../../src/utils/accessibility';

// Mock Web Speech API
const mockSpeechSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  getVoices: jest.fn(() => []),
  speaking: false,
  pending: false,
  paused: false,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

const mockSpeechSynthesisUtterance = jest.fn().mockImplementation((text) => ({
  text,
  lang: 'sv-SE',
  voice: null,
  volume: 1,
  rate: 1,
  pitch: 1,
  onstart: null,
  onend: null,
  onerror: null,
  onpause: null,
  onresume: null,
  onmark: null,
  onboundary: null,
}));

// Mock ARIA live region
const mockAriaLiveRegion = {
  setAttribute: jest.fn(),
  textContent: '',
  style: {
    position: 'absolute',
    left: '-10000px',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
  },
};

// Mock document methods
const mockDocument = {
  createElement: jest.fn(() => mockAriaLiveRegion),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn(),
  },
  getElementById: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(() => []),
  activeElement: null,
};

// Mock window
const mockWindow = {
  speechSynthesis: mockSpeechSynthesis,
  SpeechSynthesisUtterance: mockSpeechSynthesisUtterance,
  getComputedStyle: jest.fn(),
  document: mockDocument,
  setTimeout: jest.fn((fn) => fn()),
  clearTimeout: jest.fn(),
};

// Setup global mocks
beforeAll(() => {
  (global as any).window = mockWindow;
  (global as any).document = mockDocument;
  (global as any).speechSynthesis = mockSpeechSynthesis;
  (global as any).SpeechSynthesisUtterance = mockSpeechSynthesisUtterance;
});

describe('ScreenReaderSupport', () => {
  let screenReader: ScreenReaderSupport;

  beforeEach(() => {
    jest.clearAllMocks();
    screenReader = new ScreenReaderSupport();
  });

  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      expect(screenReader).toBeInstanceOf(ScreenReaderSupport);
    });

    it('should create ARIA live regions on initialization', () => {
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockDocument.body.appendChild).toHaveBeenCalled();
    });

    it('should set up ARIA live region attributes', () => {
      expect(mockAriaLiveRegion.setAttribute).toHaveBeenCalledWith('aria-live', 'polite');
      expect(mockAriaLiveRegion.setAttribute).toHaveBeenCalledWith('aria-atomic', 'true');
      expect(mockAriaLiveRegion.setAttribute).toHaveBeenCalledWith('class', 'sr-only');
    });
  });

  describe('Announcements', () => {
    it('should announce text with polite priority', () => {
      const message = 'Test announcement';
      
      screenReader.announce(message);

      expect(mockAriaLiveRegion.textContent).toBe(message);
    });

    it('should announce text with assertive priority', () => {
      const message = 'Urgent announcement';
      
      screenReader.announce(message, 'assertive');

      expect(mockAriaLiveRegion.setAttribute).toHaveBeenCalledWith('aria-live', 'assertive');
      expect(mockAriaLiveRegion.textContent).toBe(message);
    });

    it('should clear previous announcement before new one', () => {
      screenReader.announce('First message');
      screenReader.announce('Second message');

      // Should clear first, then set second
      expect(mockAriaLiveRegion.textContent).toBe('Second message');
    });

    it('should queue multiple announcements', () => {
      jest.useFakeTimers();

      screenReader.announce('First message');
      screenReader.announce('Second message');
      screenReader.announce('Third message');

      // First message should be announced immediately
      expect(mockAriaLiveRegion.textContent).toBe('First message');

      // Advance timers to process queue
      jest.advanceTimersByTime(1500);
      expect(mockAriaLiveRegion.textContent).toBe('Second message');

      jest.advanceTimersByTime(1500);
      expect(mockAriaLiveRegion.textContent).toBe('Third message');

      jest.useRealTimers();
    });

    it('should handle empty announcements gracefully', () => {
      screenReader.announce('');
      screenReader.announce(null as any);
      screenReader.announce(undefined as any);

      expect(mockAriaLiveRegion.textContent).toBe('');
    });
  });

  describe('Speech Synthesis', () => {
    it('should speak text using speech synthesis', () => {
      const message = 'Hello world';
      
      screenReader.speak(message);

      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
      expect(mockSpeechSynthesisUtterance).toHaveBeenCalledWith(message);
    });

    it('should speak with custom voice settings', () => {
      const message = 'Custom voice test';
      const options = {
        rate: 0.8,
        pitch: 1.2,
        volume: 0.9,
        lang: 'en-US'
      };
      
      screenReader.speak(message, options);

      expect(mockSpeechSynthesisUtterance).toHaveBeenCalledWith(message);
    });

    it('should handle speech synthesis not available', () => {
      delete (global as any).speechSynthesis;

      expect(() => screenReader.speak('test')).not.toThrow();
      
      // Restore for other tests
      (global as any).speechSynthesis = mockSpeechSynthesis;
    });

    it('should stop current speech', () => {
      screenReader.stopSpeaking();

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('should check if currently speaking', () => {
      mockSpeechSynthesis.speaking = true;
      
      expect(screenReader.isSpeaking()).toBe(true);

      mockSpeechSynthesis.speaking = false;
      
      expect(screenReader.isSpeaking()).toBe(false);
    });
  });

  describe('Focus Management', () => {
    it('should announce focus changes', () => {
      const mockElement = {
        getAttribute: jest.fn(),
        textContent: 'Button text',
        tagName: 'BUTTON',
        type: 'button'
      };

      screenReader.announceFocusChange(mockElement as any);

      expect(mockAriaLiveRegion.textContent).toContain('Button text');
    });

    it('should announce element with aria-label', () => {
      const mockElement = {
        getAttribute: jest.fn((attr) => attr === 'aria-label' ? 'Custom label' : null),
        textContent: 'Button text',
        tagName: 'BUTTON',
        type: 'button'
      };

      screenReader.announceFocusChange(mockElement as any);

      expect(mockAriaLiveRegion.textContent).toContain('Custom label');
    });

    it('should announce form controls appropriately', () => {
      const mockInput = {
        getAttribute: jest.fn(),
        textContent: '',
        tagName: 'INPUT',
        type: 'text',
        value: 'input value',
        placeholder: 'Enter text'
      };

      screenReader.announceFocusChange(mockInput as any);

      expect(mockAriaLiveRegion.textContent).toContain('text input');
    });

    it('should handle elements without accessible text', () => {
      const mockElement = {
        getAttribute: jest.fn(() => null),
        textContent: '',
        tagName: 'DIV',
        type: undefined
      };

      screenReader.announceFocusChange(mockElement as any);

      expect(mockAriaLiveRegion.textContent).toContain('interactive element');
    });
  });

  describe('Cleanup', () => {
    it('should dispose resources properly', () => {
      screenReader.dispose();

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
      expect(mockDocument.body.removeChild).toHaveBeenCalled();
    });

    it('should handle disposal errors gracefully', () => {
      mockDocument.body.removeChild.mockImplementation(() => {
        throw new Error('Removal failed');
      });

      expect(() => screenReader.dispose()).not.toThrow();
    });
  });
});

describe('AriaHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Label Management', () => {
    it('should set accessible label', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setAccessibleLabel(mockElement as any, 'Test label');

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-label', 'Test label');
    });

    it('should set labelledby reference', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setLabelledBy(mockElement as any, 'label-id');

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-labelledby', 'label-id');
    });

    it('should set describedby reference', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setDescribedBy(mockElement as any, 'desc-id');

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-describedby', 'desc-id');
    });

    it('should handle multiple references', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setLabelledBy(mockElement as any, ['label1', 'label2']);

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-labelledby', 'label1 label2');
    });
  });

  describe('State Management', () => {
    it('should set expanded state', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setExpanded(mockElement as any, true);

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-expanded', 'true');
    });

    it('should set selected state', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setSelected(mockElement as any, false);

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-selected', 'false');
    });

    it('should set checked state', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setChecked(mockElement as any, true);

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-checked', 'true');
    });

    it('should set disabled state', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setDisabled(mockElement as any, true);

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-disabled', 'true');
    });

    it('should set hidden state', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setHidden(mockElement as any, true);

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true');
    });
  });

  describe('Progress and Values', () => {
    it('should set progress value', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setProgress(mockElement as any, 50, 0, 100);

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-valuenow', '50');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-valuemin', '0');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-valuemax', '100');
    });

    it('should set value text', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setValueText(mockElement as any, '50 percent complete');

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-valuetext', '50 percent complete');
    });

    it('should set live region properties', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setLiveRegion(mockElement as any, 'assertive', true);

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-live', 'assertive');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-atomic', 'true');
    });
  });

  describe('Role Management', () => {
    it('should set element role', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setRole(mockElement as any, 'button');

      expect(mockElement.setAttribute).toHaveBeenCalledWith('role', 'button');
    });

    it('should validate role before setting', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      // Valid role
      AriaHelpers.setRole(mockElement as any, 'button');
      expect(mockElement.setAttribute).toHaveBeenCalledWith('role', 'button');

      // Invalid role should not be set
      jest.clearMocks();
      AriaHelpers.setRole(mockElement as any, 'invalid-role' as any);
      expect(mockElement.setAttribute).not.toHaveBeenCalled();
    });
  });

  describe('Control Relationships', () => {
    it('should set controls relationship', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setControls(mockElement as any, 'controlled-element');

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-controls', 'controlled-element');
    });

    it('should set owns relationship', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setOwns(mockElement as any, ['child1', 'child2']);

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-owns', 'child1 child2');
    });

    it('should set flowto relationship', () => {
      const mockElement = { setAttribute: jest.fn() };
      
      AriaHelpers.setFlowTo(mockElement as any, 'next-element');

      expect(mockElement.setAttribute).toHaveBeenCalledWith('aria-flowto', 'next-element');
    });
  });
});

describe('ColorContrast', () => {
  describe('Contrast Ratio Calculations', () => {
    it('should calculate contrast ratio for black and white', () => {
      const ratio = ColorContrast.calculateRatio('#000000', '#ffffff');
      expect(ratio).toBeCloseTo(21, 1);
    });

    it('should calculate contrast ratio for same colors', () => {
      const ratio = ColorContrast.calculateRatio('#000000', '#000000');
      expect(ratio).toBe(1);
    });

    it('should calculate contrast ratio for typical colors', () => {
      const ratio = ColorContrast.calculateRatio('#333333', '#ffffff');
      expect(ratio).toBeGreaterThan(4.5); // Should meet AA standards
    });

    it('should handle RGB color values', () => {
      const ratio = ColorContrast.calculateRatio('rgb(51, 51, 51)', 'rgb(255, 255, 255)');
      expect(ratio).toBeGreaterThan(4.5);
    });

    it('should handle RGBA color values', () => {
      const ratio = ColorContrast.calculateRatio('rgba(51, 51, 51, 1)', 'rgba(255, 255, 255, 1)');
      expect(ratio).toBeGreaterThan(4.5);
    });

    it('should handle invalid color values gracefully', () => {
      const ratio = ColorContrast.calculateRatio('invalid-color', '#ffffff');
      expect(ratio).toBe(1); // Should return minimum ratio for invalid colors
    });
  });

  describe('WCAG Compliance Checks', () => {
    it('should check AA compliance for normal text', () => {
      const isCompliant = ColorContrast.meetsWCAG('#333333', '#ffffff', 'AA', false);
      expect(isCompliant).toBe(true);
    });

    it('should check AA compliance for large text', () => {
      const isCompliant = ColorContrast.meetsWCAG('#666666', '#ffffff', 'AA', true);
      expect(isCompliant).toBe(true);
    });

    it('should check AAA compliance', () => {
      const isCompliant = ColorContrast.meetsWCAG('#000000', '#ffffff', 'AAA', false);
      expect(isCompliant).toBe(true);
    });

    it('should fail compliance for poor contrast', () => {
      const isCompliant = ColorContrast.meetsWCAG('#cccccc', '#ffffff', 'AA', false);
      expect(isCompliant).toBe(false);
    });
  });

  describe('Color Analysis', () => {
    it('should get detailed contrast information', () => {
      const info = ColorContrast.getContrastInfo('#333333', '#ffffff');

      expect(info).toEqual({
        ratio: expect.any(Number),
        level: expect.stringMatching(/^(AAA|AA|fail)$/),
        meetsAA: expect.any(Boolean),
        meetsAAA: expect.any(Boolean),
        meetsAALarge: expect.any(Boolean),
        meetsAAALarge: expect.any(Boolean),
      });
    });

    it('should suggest improvements for poor contrast', () => {
      const suggestions = ColorContrast.suggestImprovements('#cccccc', '#ffffff');

      expect(suggestions).toEqual({
        currentRatio: expect.any(Number),
        targetRatio: 4.5,
        suggestions: expect.arrayContaining([
          expect.stringMatching(/darker.*text|lighter.*background/i)
        ])
      });
    });

    it('should provide no suggestions for good contrast', () => {
      const suggestions = ColorContrast.suggestImprovements('#000000', '#ffffff');

      expect(suggestions.suggestions).toHaveLength(0);
    });
  });

  describe('Luminance Calculations', () => {
    it('should calculate relative luminance correctly', () => {
      const whiteLuminance = ColorContrast.getRelativeLuminance('#ffffff');
      const blackLuminance = ColorContrast.getRelativeLuminance('#000000');

      expect(whiteLuminance).toBe(1);
      expect(blackLuminance).toBe(0);
    });

    it('should calculate luminance for mid-range colors', () => {
      const grayLuminance = ColorContrast.getRelativeLuminance('#808080');
      
      expect(grayLuminance).toBeGreaterThan(0);
      expect(grayLuminance).toBeLessThan(1);
    });
  });
});

describe('TextReadability', () => {
  describe('Flesch Reading Score', () => {
    it('should calculate Flesch score for simple text', () => {
      const text = 'This is simple text. It has short sentences. Easy to read.';
      const score = TextReadability.calculateFleschScore(text);

      expect(score).toBeGreaterThan(80); // Should be "easy" level
    });

    it('should calculate Flesch score for complex text', () => {
      const text = 'The implementation of sophisticated algorithms requires comprehensive understanding of computational complexity and algorithmic efficiency paradigms.';
      const score = TextReadability.calculateFleschScore(text);

      expect(score).toBeLessThan(50); // Should be "difficult" level
    });

    it('should handle empty text', () => {
      const score = TextReadability.calculateFleschScore('');
      expect(score).toBe(0);
    });

    it('should handle text with no sentences', () => {
      const score = TextReadability.calculateFleschScore('word word word');
      expect(score).toBe(0);
    });
  });

  describe('Readability Level Assessment', () => {
    it('should classify easy readability', () => {
      const level = TextReadability.getReadabilityLevel(90);
      expect(level).toBe('very_easy');
    });

    it('should classify difficult readability', () => {
      const level = TextReadability.getReadabilityLevel(25);
      expect(level).toBe('very_difficult');
    });

    it('should classify medium readability', () => {
      const level = TextReadability.getReadabilityLevel(60);
      expect(level).toBe('standard');
    });
  });

  describe('Text Analysis', () => {
    it('should count syllables correctly', () => {
      const syllables1 = TextReadability.countSyllables('cat');
      const syllables2 = TextReadability.countSyllables('reading');
      const syllables3 = TextReadability.countSyllables('beautiful');

      expect(syllables1).toBe(1);
      expect(syllables2).toBe(2);
      expect(syllables3).toBe(3);
    });

    it('should count sentences correctly', () => {
      const text = 'First sentence. Second sentence! Third sentence?';
      const sentences = TextReadability.countSentences(text);

      expect(sentences).toBe(3);
    });

    it('should count words correctly', () => {
      const text = 'This is a test sentence with seven words.';
      const words = TextReadability.countWords(text);

      expect(words).toBe(8);
    });

    it('should handle complex punctuation', () => {
      const text = 'Mr. Smith went to the U.S.A. He said "Hello!"';
      const sentences = TextReadability.countSentences(text);

      expect(sentences).toBe(2); // Should not count abbreviations as sentences
    });
  });

  describe('Content Suggestions', () => {
    it('should suggest improvements for difficult text', () => {
      const text = 'The utilization of multifaceted algorithmic implementations necessitates comprehensive understanding.';
      const suggestions = TextReadability.getSuggestions(text);

      expect(suggestions).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/shorter sentences/i),
          expect.stringMatching(/simpler words/i)
        ])
      );
    });

    it('should provide no suggestions for readable text', () => {
      const text = 'This is simple text. It is easy to read. Everyone can understand it.';
      const suggestions = TextReadability.getSuggestions(text);

      expect(suggestions).toHaveLength(0);
    });

    it('should suggest sentence length improvements', () => {
      const longSentence = 'This is a very long sentence that contains many words and clauses and subclauses and goes on and on without stopping which makes it very hard to read and understand for most people.';
      const suggestions = TextReadability.getSuggestions(longSentence);

      expect(suggestions).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/shorter sentences/i)
        ])
      );
    });
  });

  describe('Accessibility Compliance', () => {
    it('should check if text meets accessibility standards', () => {
      const simpleText = 'This is easy to read. Short sentences help.';
      const isAccessible = TextReadability.meetsAccessibilityStandards(simpleText);

      expect(isAccessible).toBe(true);
    });

    it('should fail accessibility for complex text', () => {
      const complexText = 'The implementation of sophisticated methodological approaches necessitates comprehensive understanding of complex interdisciplinary paradigms.';
      const isAccessible = TextReadability.meetsAccessibilityStandards(complexText);

      expect(isAccessible).toBe(false);
    });

    it('should provide reading level assessment', () => {
      const text = 'This is a test. It checks reading level.';
      const assessment = TextReadability.getReadingLevelAssessment(text);

      expect(assessment).toEqual({
        fleschScore: expect.any(Number),
        readabilityLevel: expect.any(String),
        estimatedGradeLevel: expect.any(Number),
        wordsCount: expect.any(Number),
        sentencesCount: expect.any(Number),
        syllablesCount: expect.any(Number),
        averageWordsPerSentence: expect.any(Number),
        averageSyllablesPerWord: expect.any(Number),
        meetsAccessibilityStandards: expect.any(Boolean),
        suggestions: expect.any(Array)
      });
    });
  });
});