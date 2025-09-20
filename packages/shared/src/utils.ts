// Enhanced shared utilities for Vocilia platform

/**
 * Format a phone number for display
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '')

  // Swedish phone number format
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`
  }

  return phoneNumber
}

/**
 * Format currency for Swedish Krona
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
  }).format(amount)
}

/**
 * Calculate cashback percentage based on feedback quality
 */
export function calculateCashbackPercentage(
  rating: number,
  hasDetailedFeedback: boolean,
  sentimentScore: number
): number {
  let percentage = 2 // Base 2%

  // Rating bonus (up to 5%)
  if (rating >= 4) percentage += 3
  else if (rating >= 3) percentage += 1

  // Detailed feedback bonus (3%)
  if (hasDetailedFeedback) percentage += 3

  // Sentiment bonus (up to 7%)
  if (sentimentScore > 0.7) percentage += 7
  else if (sentimentScore > 0.3) percentage += 3

  return Math.min(percentage, 15) // Max 15%
}

/**
 * Generate a QR code data string for a store
 */
export function generateQRCodeData(storeId: string, businessId: string): string {
  const baseUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://alpha.vocilia.com'
  return `${baseUrl}/feedback/${businessId}/${storeId}`
}

/**
 * Validate Swedish phone number
 */
export function isValidSwedishPhoneNumber(phoneNumber: string): boolean {
  const cleaned = phoneNumber.replace(/\D/g, '')
  return cleaned.length === 10 && cleaned.startsWith('0')
}

/**
 * Sleep utility for development and testing
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}