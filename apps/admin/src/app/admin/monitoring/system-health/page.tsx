'use client'

import React from 'react'
import SystemHealthDashboard from '../../../../components/monitoring/SystemHealthDashboard'

export default function SystemHealthPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
        <p className="text-gray-600 mt-2">
          Monitor real-time system performance, service status, and infrastructure metrics
        </p>
      </div>
      
      <SystemHealthDashboard />
    </div>
  )
}