// Common types for Project Alpha

export interface BaseEntity {
  id: string
  createdAt: Date
  updatedAt: Date
}

export interface Customer extends BaseEntity {
  phoneNumber: string
  feedbackCount: number
  totalCashback: number
}

export interface Business extends BaseEntity {
  name: string
  email: string
  storeCount: number
  isActive: boolean
}

export interface Feedback extends BaseEntity {
  customerId: string
  businessId: string
  storeId: string
  transactionId: string
  rating: number
  content: string
  sentiment: 'positive' | 'neutral' | 'negative'
  cashbackAmount: number
  isVerified: boolean
}

export interface Store extends BaseEntity {
  businessId: string
  name: string
  address: string
  qrCode: string
  isActive: boolean
}

export type Environment = 'development' | 'staging' | 'production'

export interface ApiResponse<T = unknown> {
  data: T
  success: boolean
  message?: string
  error?: string
}