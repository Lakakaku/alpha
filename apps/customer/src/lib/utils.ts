import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a phone number for display
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digits
  const digits = phoneNumber.replace(/\D/g, '');

  // Format Swedish phone numbers
  if (digits.startsWith('46')) {
    // International format: +46 70 123 45 67
    const formatted = digits.replace(/^46(\d{2})(\d{3})(\d{2})(\d{2})$/, '+46 $1 $2 $3 $4');
    return formatted;
  } else if (digits.startsWith('0') && digits.length === 10) {
    // National format: 070-123 45 67
    const formatted = digits.replace(/^0(\d{2})(\d{3})(\d{2})(\d{2})$/, '0$1-$2 $3 $4');
    return formatted;
  }

  return phoneNumber;
}

/**
 * Validate Swedish phone number format
 */
export function isValidSwedishPhoneNumber(phoneNumber: string): boolean {
  const digits = phoneNumber.replace(/\D/g, '');

  // Check for Swedish mobile numbers
  if (digits.startsWith('46')) {
    // International format: +46 followed by 9 digits (70-79 for mobile)
    return /^46[789]\d{8}$/.test(digits);
  } else if (digits.startsWith('0')) {
    // National format: 0 followed by 9 digits (070-079 for mobile)
    return /^0[789]\d{8}$/.test(digits);
  }

  return false;
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency = 'SEK'): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format time string (HH:MM) for display
 */
export function formatTime(time: string): string {
  // Validate time format
  if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
    return time;
  }

  const [hours, minutes] = time.split(':');
  return `${hours.padStart(2, '0')}:${minutes}`;
}

/**
 * Get current time in HH:MM format
 */
export function getCurrentTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Calculate time difference in minutes
 */
export function getTimeDifferenceMinutes(time1: string, time2: string): number {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);

  const minutes1 = h1 * 60 + m1;
  const minutes2 = h2 * 60 + m2;

  return Math.abs(minutes1 - minutes2);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Generate a random UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}