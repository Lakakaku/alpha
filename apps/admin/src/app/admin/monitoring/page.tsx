'use client'

import { useState } from 'react'
import SystemHealthDashboard from '../../../components/monitoring/SystemHealthDashboard'
import ErrorTrackingDashboard from '../../../components/monitoring/ErrorTrackingDashboard'
import AlertRulesDashboard from '../../../components/monitoring/AlertRulesDashboard'
import BusinessIntelligenceDashboard from '../../../components/monitoring/BusinessIntelligenceDashboard'
import DataExportDashboard from '../../../components/monitoring/DataExportDashboard'

const MONITORING_SECTIONS = [
  { 
    id: 'system-health', 
    label: 'System Health', 
    icon: '🖥️',
    description: 'Real-time system metrics and performance monitoring'
  },
  { 
    id: 'error-tracking', 
    label: 'Error Tracking', 
    icon: '🐛',
    description: 'Application error logs and resolution tracking'
  },
  { 
    id: 'alert-rules', 
    label: 'Alert Rules', 
    icon: '🚨',
    description: 'Configure alert thresholds and notifications'
  },
  { 
    id: 'business-intelligence', 
    label: 'Business Intelligence', 
    icon: '📊',
    description: 'Revenue analytics and fraud detection reports'
  },
  { 
    id: 'data-export', 
    label: 'Data Export', 
    icon: '📥',
    description: 'Export analytics data in multiple formats'
  }
]

export default function MonitoringPage() {
  const [activeSection, setActiveSection] = useState('system-health')

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'system-health':
        return <SystemHealthDashboard />
      case 'error-tracking':
        return <ErrorTrackingDashboard />
      case 'alert-rules':
        return <AlertRulesDashboard />
      case 'business-intelligence':
        return <BusinessIntelligenceDashboard />
      case 'data-export':
        return <DataExportDashboard />
      default:
        return <SystemHealthDashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Monitoring & Analytics</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive monitoring dashboard for system health, business intelligence, and data analytics
          </p>
        </div>

        {/* Section Navigation */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-gray-200">
            {MONITORING_SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`p-6 text-left hover:bg-gray-50 transition-colors ${
                  activeSection === section.id ? 'bg-blue-50 border-b-2 border-blue-500' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{section.icon}</span>
                  <div>
                    <div className={`font-medium ${
                      activeSection === section.id ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {section.label}
                    </div>
                    <div className={`text-sm mt-1 ${
                      activeSection === section.id ? 'text-blue-700' : 'text-gray-500'
                    }`}>
                      {section.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Active Section Content */}
        <div>
          {renderActiveSection()}
        </div>
      </div>
    </div>
  )
}