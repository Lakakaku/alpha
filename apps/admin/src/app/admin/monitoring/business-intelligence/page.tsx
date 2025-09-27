'use client'

import React from 'react'
import BusinessIntelligenceDashboard from '../../../../components/monitoring/BusinessIntelligenceDashboard'

export default function BusinessIntelligencePage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Business Intelligence</h1>
        <p className="text-gray-600 mt-2">
          Advanced analytics for fraud detection, revenue insights, and performance optimization
        </p>
      </div>
      
      <BusinessIntelligenceDashboard />
    </div>
  )
}