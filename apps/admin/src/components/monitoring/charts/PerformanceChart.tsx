'use client'

import React from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

interface BusinessPerformanceMetrics {
  id: string
  report_date: string
  store_id: string
  business_id: string
  feedback_volume_trend?: number
  verification_rate?: number
  customer_satisfaction_score?: number
  operational_metrics: Record<string, any>
}

interface PerformanceChartProps {
  data: BusinessPerformanceMetrics[]
  height?: number
}

export function PerformanceChart({ data, height = 400 }: PerformanceChartProps) {
  // Transform data for scatter plot showing performance relationships
  const processedData = React.useMemo(() => {
    if (!data || data.length === 0) return []

    return data
      .filter(item => 
        item.verification_rate !== undefined && 
        item.customer_satisfaction_score !== undefined &&
        item.feedback_volume_trend !== undefined
      )
      .map(item => ({
        store_id: item.store_id,
        verification_rate: (item.verification_rate || 0) * 100, // Convert to percentage
        customer_satisfaction_score: item.customer_satisfaction_score || 0,
        feedback_volume_trend: item.feedback_volume_trend || 0,
        // Size bubble based on absolute feedback volume trend
        bubble_size: Math.abs(item.feedback_volume_trend || 0) * 1000 + 50,
        // Color based on trend direction
        trend_color: (item.feedback_volume_trend || 0) >= 0 ? '#10B981' : '#EF4444',
        report_date: item.report_date
      }))
      .sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime())
  }, [data])

  // Separate data by trend direction for different colors
  const positiveData = processedData.filter(item => item.feedback_volume_trend >= 0)
  const negativeData = processedData.filter(item => item.feedback_volume_trend < 0)

  const formatTooltipValue = (value: number, name: string, props: any) => {
    const { payload } = props
    
    switch (name) {
      case 'verification_rate':
        return [`${value.toFixed(1)}%`, 'Verification Rate']
      case 'customer_satisfaction_score':
        return [value.toFixed(1), 'Customer Satisfaction']
      default:
        return [value, name]
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">
            Store: {data.store_id.slice(0, 8)}...
          </p>
          <div className="space-y-1 text-sm">
            <p className="text-gray-700">
              <span className="font-medium">Verification Rate:</span> {data.verification_rate.toFixed(1)}%
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Customer Satisfaction:</span> {data.customer_satisfaction_score.toFixed(1)}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Volume Trend:</span> 
              <span className={data.feedback_volume_trend >= 0 ? 'text-green-600' : 'text-red-600'}>
                {data.feedback_volume_trend >= 0 ? '+' : ''}{(data.feedback_volume_trend * 100).toFixed(1)}%
              </span>
            </p>
            <p className="text-xs text-gray-500">
              {new Date(data.report_date).toLocaleDateString()}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-2">📈</div>
          <p className="text-gray-500">No performance data available</p>
          <p className="text-sm text-gray-400">Try adjusting your filters or criteria</p>
        </div>
      </div>
    )
  }

  if (processedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-2">⚠️</div>
          <p className="text-gray-500">Insufficient data for performance chart</p>
          <p className="text-sm text-gray-400">Need verification rate, satisfaction score, and volume trend data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full" style={{ height }}>
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-1">Performance Correlation Analysis</h4>
        <p className="text-xs text-blue-700">
          X-axis: Verification Rate (%) • Y-axis: Customer Satisfaction (1-5) • 
          Bubble Size: Volume Trend Magnitude • 
          <span className="inline-block w-3 h-3 bg-green-500 rounded-full mx-1"></span>Green: Positive Trend • 
          <span className="inline-block w-3 h-3 bg-red-500 rounded-full mx-1"></span>Red: Negative Trend
        </p>
      </div>
      
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="verification_rate"
            domain={[0, 100]}
            type="number"
            stroke="#6B7280"
            fontSize={12}
            label={{ value: 'Verification Rate (%)', position: 'insideBottom', offset: -10 }}
          />
          <YAxis 
            dataKey="customer_satisfaction_score"
            domain={[0, 5]}
            type="number"
            stroke="#6B7280"
            fontSize={12}
            label={{ value: 'Customer Satisfaction', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
            payload={[
              { value: 'Positive Volume Trend', type: 'circle', color: '#10B981' },
              { value: 'Negative Volume Trend', type: 'circle', color: '#EF4444' }
            ]}
          />
          
          {/* Reference lines for benchmarks */}
          <ReferenceLine 
            x={80} 
            stroke="#F59E0B" 
            strokeDasharray="2 2" 
            label={{ value: "80% Target", position: "topLeft", fontSize: 10 }}
          />
          <ReferenceLine 
            y={4} 
            stroke="#F59E0B" 
            strokeDasharray="2 2" 
            label={{ value: "4.0 Target", position: "topRight", fontSize: 10 }}
          />
          
          {/* Positive trend stores */}
          {positiveData.length > 0 && (
            <Scatter 
              data={positiveData}
              fill="#10B981"
              name="Positive Volume Trend"
            />
          )}
          
          {/* Negative trend stores */}
          {negativeData.length > 0 && (
            <Scatter 
              data={negativeData}
              fill="#EF4444"
              name="Negative Volume Trend"
            />
          )}
        </ScatterChart>
      </ResponsiveContainer>
      
      {/* Performance Insights */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="font-medium text-green-900">High Performers</div>
          <div className="text-green-700">
            {processedData.filter(d => d.verification_rate >= 80 && d.customer_satisfaction_score >= 4).length} stores
          </div>
          <div className="text-xs text-green-600">≥80% verification, ≥4.0 satisfaction</div>
        </div>
        
        <div className="bg-yellow-50 p-3 rounded-lg">
          <div className="font-medium text-yellow-900">Growing Stores</div>
          <div className="text-yellow-700">
            {positiveData.length} stores
          </div>
          <div className="text-xs text-yellow-600">Positive feedback volume trend</div>
        </div>
        
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="font-medium text-red-900">At Risk</div>
          <div className="text-red-700">
            {processedData.filter(d => d.verification_rate < 60 || d.customer_satisfaction_score < 3).length} stores
          </div>
          <div className="text-xs text-red-600">&lt;60% verification or &lt;3.0 satisfaction</div>
        </div>
      </div>
    </div>
  )
}

// Export as default for dynamic imports
export default PerformanceChart