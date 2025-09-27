'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface CreateStoreFormData {
  name: string
  email: string
  phone_number: string
  physical_address: string
}

interface ValidationErrors {
  name?: string
  email?: string
  phone_number?: string
  physical_address?: string
  general?: string
}

export default function CreateStoreForm() {
  const router = useRouter()
  const [formData, setFormData] = useState<CreateStoreFormData>({
    name: '',
    email: '',
    phone_number: '',
    physical_address: ''
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [loading, setLoading] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {}

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Store name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Store name must be at least 2 characters'
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Phone validation (Swedish format)
    const phoneRegex = /^(\+46|0)[1-9]\d{8,9}$/
    if (formData.phone_number && !phoneRegex.test(formData.phone_number.replace(/\s/g, ''))) {
      newErrors.phone_number = 'Please enter a valid Swedish phone number'
    }

    // Address validation
    if (formData.physical_address && formData.physical_address.trim().length < 10) {
      newErrors.physical_address = 'Address must be at least 10 characters if provided'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)
      setErrors({})

      const response = await fetch('/api/admin/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone_number: formData.phone_number.trim() || null,
          physical_address: formData.physical_address.trim() || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 409) {
          setErrors({ email: 'A store with this email already exists' })
        } else {
          setErrors({ general: errorData.message || 'Failed to create store' })
        }
        return
      }

      const newStore = await response.json()
      router.push(`/admin/stores/${newStore.id}`)
    } catch (err) {
      setErrors({ general: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof CreateStoreFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters except +
    const cleaned = value.replace(/[^\d+]/g, '')
    
    // If starts with +46, format as +46 XX XXX XX XX
    if (cleaned.startsWith('+46')) {
      const digits = cleaned.slice(3)
      if (digits.length <= 2) return `+46 ${digits}`
      if (digits.length <= 5) return `+46 ${digits.slice(0, 2)} ${digits.slice(2)}`
      if (digits.length <= 7) return `+46 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`
      return `+46 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`
    }
    
    // If starts with 0, format as 0XX XXX XX XX
    if (cleaned.startsWith('0')) {
      if (cleaned.length <= 3) return cleaned
      if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`
      if (cleaned.length <= 8) return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`
    }
    
    return cleaned
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin/stores')}
            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
          >
            ← Back to Stores
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Create New Store</h1>
          <p className="text-gray-600 mt-2">Add a new store to the Vocilia platform</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* General Error */}
            {errors.general && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <div className="text-red-600 text-sm">⚠️</div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <p className="text-sm text-red-700">{errors.general}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Store Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Store Name *
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter store name"
                disabled={loading}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.email ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="store@example.com"
                disabled={loading}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                id="phone"
                value={formData.phone_number}
                onChange={(e) => handleInputChange('phone_number', formatPhoneNumber(e.target.value))}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.phone_number ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="+46 XX XXX XX XX or 0XX XXX XX XX"
                disabled={loading}
              />
              {errors.phone_number && (
                <p className="mt-1 text-sm text-red-600">{errors.phone_number}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Swedish phone number format: +46 XX XXX XX XX or 0XX XXX XX XX
              </p>
            </div>

            {/* Physical Address */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Physical Address (Optional)
              </label>
              <textarea
                id="address"
                value={formData.physical_address}
                onChange={(e) => handleInputChange('physical_address', e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.physical_address ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Street address, city, postal code"
                disabled={loading}
              />
              {errors.physical_address && (
                <p className="mt-1 text-sm text-red-600">{errors.physical_address}</p>
              )}
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => router.push('/admin/stores')}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </span>
                ) : (
                  'Create Store'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Help Text */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">📋 Create Store Instructions</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Store name and email address are required fields</li>
            <li>• Email must be unique across all stores in the system</li>
            <li>• Phone number should be in Swedish format if provided</li>
            <li>• Physical address helps with location-based features</li>
            <li>• After creation, you can generate QR codes and configure settings</li>
          </ul>
        </div>
      </div>
    </div>
  )
}