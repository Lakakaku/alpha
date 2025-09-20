import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatDate,
  parseDate,
  isValidEmail,
  isValidPhoneNumber,
  sanitizeInput,
  generateSlug,
  truncateText,
  capitalizeText,
  formatCurrency,
  formatPhoneNumber,
  validatePassword,
  generateQRCode,
  createLogger,
  debounce,
  throttle,
  deepMerge,
  arrayUnique,
  groupBy,
  sortBy,
  formatFileSize,
  isValidUrl,
  encodeBase64,
  decodeBase64,
  hashString,
  generateId,
  sleep,
  retry
} from '../../../packages/shared/src/utils';

describe('Date Utilities', () => {
  describe('formatDate', () => {
    it('should format date with default format', () => {
      const date = new Date('2023-12-25T10:30:00Z');
      const formatted = formatDate(date);
      expect(formatted).toMatch(/2023-12-25/);
    });

    it('should format date with custom format', () => {
      const date = new Date('2023-12-25T10:30:00Z');
      const formatted = formatDate(date, 'MM/DD/YYYY');
      expect(formatted).toBe('12/25/2023');
    });

    it('should handle invalid dates', () => {
      const invalidDate = new Date('invalid');
      expect(() => formatDate(invalidDate)).toThrow('Invalid date');
    });
  });

  describe('parseDate', () => {
    it('should parse ISO date string', () => {
      const dateString = '2023-12-25T10:30:00Z';
      const parsed = parseDate(dateString);
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.getFullYear()).toBe(2023);
    });

    it('should parse date with custom format', () => {
      const dateString = '25/12/2023';
      const parsed = parseDate(dateString, 'DD/MM/YYYY');
      expect(parsed.getFullYear()).toBe(2023);
      expect(parsed.getMonth()).toBe(11); // December
    });

    it('should handle invalid date strings', () => {
      expect(() => parseDate('invalid-date')).toThrow('Invalid date string');
    });
  });
});

describe('Validation Utilities', () => {
  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(isValidEmail('user123@test-domain.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user@@domain.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should validate international phone numbers', () => {
      expect(isValidPhoneNumber('+1234567890')).toBe(true);
      expect(isValidPhoneNumber('+46701234567')).toBe(true);
      expect(isValidPhoneNumber('+44 20 7946 0958')).toBe(true);
    });

    it('should validate local phone numbers', () => {
      expect(isValidPhoneNumber('0701234567', 'SE')).toBe(true);
      expect(isValidPhoneNumber('(555) 123-4567', 'US')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidPhoneNumber('123')).toBe(false);
      expect(isValidPhoneNumber('abc123')).toBe(false);
      expect(isValidPhoneNumber('')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const result = validatePassword('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it('should reject weak passwords', () => {
      const result = validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should provide detailed feedback', () => {
      const result = validatePassword('password');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000/path')).toBe(true);
      expect(isValidUrl('ftp://files.example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('http://')).toBe(false);
      expect(isValidUrl('')).toBe(false);
    });
  });
});

describe('String Utilities', () => {
  describe('sanitizeInput', () => {
    it('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const sanitized = sanitizeInput(input);
      expect(sanitized).toBe('Hello World');
    });

    it('should handle special characters', () => {
      const input = 'Hello & "World" <tag>';
      const sanitized = sanitizeInput(input);
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });

    it('should preserve safe content', () => {
      const input = 'Hello World 123';
      const sanitized = sanitizeInput(input);
      expect(sanitized).toBe('Hello World 123');
    });
  });

  describe('generateSlug', () => {
    it('should create URL-friendly slugs', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
      expect(generateSlug('Test & Example')).toBe('test-example');
      expect(generateSlug('  Multiple   Spaces  ')).toBe('multiple-spaces');
    });

    it('should handle special characters', () => {
      expect(generateSlug('Café & Restaurant')).toBe('cafe-restaurant');
      expect(generateSlug('User@Domain.com')).toBe('user-domain-com');
    });

    it('should handle empty strings', () => {
      expect(generateSlug('')).toBe('');
      expect(generateSlug('   ')).toBe('');
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const text = 'This is a very long text that should be truncated';
      const truncated = truncateText(text, 20);
      expect(truncated).toBe('This is a very long...');
      expect(truncated.length).toBeLessThanOrEqual(23); // 20 + '...'
    });

    it('should not truncate short text', () => {
      const text = 'Short text';
      const truncated = truncateText(text, 20);
      expect(truncated).toBe('Short text');
    });

    it('should handle custom suffixes', () => {
      const text = 'This is a long text';
      const truncated = truncateText(text, 10, ' [more]');
      expect(truncated).toBe('This is a [more]');
    });
  });

  describe('capitalizeText', () => {
    it('should capitalize first letter', () => {
      expect(capitalizeText('hello world')).toBe('Hello world');
      expect(capitalizeText('HELLO WORLD')).toBe('Hello world');
    });

    it('should capitalize each word', () => {
      expect(capitalizeText('hello world', true)).toBe('Hello World');
      expect(capitalizeText('hello-world test', true)).toBe('Hello-World Test');
    });

    it('should handle empty strings', () => {
      expect(capitalizeText('')).toBe('');
      expect(capitalizeText('a')).toBe('A');
    });
  });
});

describe('Formatting Utilities', () => {
  describe('formatCurrency', () => {
    it('should format currency with default settings', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format currency with custom settings', () => {
      expect(formatCurrency(1234.56, 'EUR', 'de-DE')).toMatch(/1\.234,56/);
      expect(formatCurrency(1234.56, 'SEK', 'sv-SE')).toMatch(/1 234,56/);
    });

    it('should handle negative amounts', () => {
      expect(formatCurrency(-100)).toBe('-$100.00');
    });
  });

  describe('formatPhoneNumber', () => {
    it('should format US phone numbers', () => {
      expect(formatPhoneNumber('5551234567', 'US')).toBe('(555) 123-4567');
      expect(formatPhoneNumber('+15551234567')).toBe('+1 (555) 123-4567');
    });

    it('should format Swedish phone numbers', () => {
      expect(formatPhoneNumber('0701234567', 'SE')).toBe('070-123 45 67');
      expect(formatPhoneNumber('+46701234567')).toBe('+46 70-123 45 67');
    });

    it('should handle invalid numbers', () => {
      expect(formatPhoneNumber('invalid')).toBe('invalid');
      expect(formatPhoneNumber('')).toBe('');
    });
  });

  describe('formatFileSize', () => {
    it('should format file sizes in bytes', () => {
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1048576)).toBe('1.0 MB');
      expect(formatFileSize(1073741824)).toBe('1.0 GB');
    });

    it('should handle small sizes', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('should format with custom precision', () => {
      expect(formatFileSize(1536, 2)).toBe('1.50 KB');
      expect(formatFileSize(1536, 0)).toBe('2 KB');
    });
  });
});

describe('Array Utilities', () => {
  describe('arrayUnique', () => {
    it('should remove duplicate values', () => {
      expect(arrayUnique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3]);
      expect(arrayUnique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
    });

    it('should handle empty arrays', () => {
      expect(arrayUnique([])).toEqual([]);
    });

    it('should preserve order', () => {
      expect(arrayUnique([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
    });
  });

  describe('groupBy', () => {
    it('should group objects by property', () => {
      const data = [
        { category: 'fruit', name: 'apple' },
        { category: 'vegetable', name: 'carrot' },
        { category: 'fruit', name: 'banana' }
      ];
      
      const grouped = groupBy(data, 'category');
      expect(grouped.fruit).toHaveLength(2);
      expect(grouped.vegetable).toHaveLength(1);
    });

    it('should group by function', () => {
      const data = [1, 2, 3, 4, 5, 6];
      const grouped = groupBy(data, (x) => x % 2 === 0 ? 'even' : 'odd');
      
      expect(grouped.even).toEqual([2, 4, 6]);
      expect(grouped.odd).toEqual([1, 3, 5]);
    });
  });

  describe('sortBy', () => {
    it('should sort objects by property', () => {
      const data = [
        { name: 'Charlie', age: 30 },
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 35 }
      ];
      
      const sorted = sortBy(data, 'name');
      expect(sorted[0].name).toBe('Alice');
      expect(sorted[2].name).toBe('Charlie');
    });

    it('should sort by function', () => {
      const data = [{ age: 30 }, { age: 25 }, { age: 35 }];
      const sorted = sortBy(data, (item) => item.age);
      
      expect(sorted[0].age).toBe(25);
      expect(sorted[2].age).toBe(35);
    });
  });
});

describe('Encoding Utilities', () => {
  describe('encodeBase64 / decodeBase64', () => {
    it('should encode and decode text', () => {
      const text = 'Hello World';
      const encoded = encodeBase64(text);
      const decoded = decodeBase64(encoded);
      
      expect(decoded).toBe(text);
    });

    it('should handle special characters', () => {
      const text = 'Café & Restaurant 🍽️';
      const encoded = encodeBase64(text);
      const decoded = decodeBase64(encoded);
      
      expect(decoded).toBe(text);
    });

    it('should handle empty strings', () => {
      expect(encodeBase64('')).toBe('');
      expect(decodeBase64('')).toBe('');
    });
  });

  describe('hashString', () => {
    it('should create consistent hashes', () => {
      const text = 'test string';
      const hash1 = hashString(text);
      const hash2 = hashString(text);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
    });

    it('should create different hashes for different inputs', () => {
      const hash1 = hashString('test1');
      const hash2 = hashString('test2');
      
      expect(hash1).not.toBe(hash2);
    });
  });
});

describe('Utility Functions', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).not.toBe(id2);
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should generate IDs of specified length', () => {
      const id = generateId(16);
      expect(id.length).toBe(16);
    });
  });

  describe('generateQRCode', () => {
    it('should generate QR code data URL', async () => {
      const qrCode = await generateQRCode('https://example.com');
      expect(qrCode).toMatch(/^data:image\/png;base64,/);
    });

    it('should handle different data types', async () => {
      const textQR = await generateQRCode('Simple text');
      const urlQR = await generateQRCode('https://example.com');
      
      expect(textQR).toBeTruthy();
      expect(urlQR).toBeTruthy();
      expect(textQR).not.toBe(urlQR);
    });
  });

  describe('deepMerge', () => {
    it('should merge objects deeply', () => {
      const obj1 = { a: 1, b: { c: 2, d: 3 } };
      const obj2 = { b: { d: 4, e: 5 }, f: 6 };
      
      const merged = deepMerge(obj1, obj2);
      
      expect(merged).toEqual({
        a: 1,
        b: { c: 2, d: 4, e: 5 },
        f: 6
      });
    });

    it('should handle arrays', () => {
      const obj1 = { arr: [1, 2] };
      const obj2 = { arr: [3, 4] };
      
      const merged = deepMerge(obj1, obj2);
      expect(merged.arr).toEqual([3, 4]); // Arrays are replaced, not merged
    });
  });

  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await sleep(100);
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('retry', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Failed');
        }
        return 'success';
      };
      
      const result = await retry(operation, 3);
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should fail after max attempts', async () => {
      const operation = () => {
        throw new Error('Always fails');
      };
      
      await expect(retry(operation, 2)).rejects.toThrow('Always fails');
    });
  });
});

describe('Function Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('debounce', () => {
    it('should debounce function calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      expect(fn).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass latest arguments', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);
      
      debouncedFn('first');
      debouncedFn('second');
      debouncedFn('third');
      
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledWith('third');
    });
  });

  describe('throttle', () => {
    it('should throttle function calls', () => {
      const fn = vi.fn();
      const throttledFn = throttle(fn, 100);
      
      throttledFn();
      throttledFn();
      throttledFn();
      
      expect(fn).toHaveBeenCalledTimes(1);
      
      vi.advanceTimersByTime(100);
      throttledFn();
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Logger Utility', () => {
  it('should create logger with different levels', () => {
    const logger = createLogger('test-module');
    
    expect(logger.info).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  it('should log with context', () => {
    const logger = createLogger('test-module');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    logger.info('Test message', { key: 'value' });
    
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});