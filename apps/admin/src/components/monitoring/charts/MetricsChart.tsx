'use client'

import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface SystemMetric {
  id: string
  timestamp: string
  metric_type: 'api_response_time' | 'cpu_usage' | 'memory_usage' | 'error_rate'
  metric_value: number
  service_name: 'backend' | 'customer_app' | 'business_app' | 'admin_app'
  additional_data: Record<string, any>
}

interface MetricsChartProps {
  data: SystemMetric[]
  granularity: 'minute' | 'hour' | 'day'
  height?: number
}

const SERVICE_COLORS = {
  backend: '#3B82F6',
  customer_app: '#10B981',
  business_app: '#F59E0B',
  admin_app: '#8B5CF6'
}

const METRIC_UNITS = {
  api_response_time: 'ms',
  cpu_usage: '%',
  memory_usage: '%',
  error_rate: '%'
}

export function MetricsChart({ data, granularity, height = 400 }: MetricsChartProps) {
  // Transform and aggregate data for charting
  const processedData = React.useMemo(() => {
    if (!data || data.length === 0) return []

    // Group data by timestamp and service
    const grouped = data.reduce((acc, metric) => {
      const timestamp = new Date(metric.timestamp)
      let timeKey: string

      // Adjust time key based on granularity
      switch (granularity) {
        case 'minute':
          timeKey = timestamp.toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM
          break
        case 'hour':
          timeKey = timestamp.toISOString().slice(0, 13) + ':00' // YYYY-MM-DDTHH:00
          break
        case 'day':
          timeKey = timestamp.toISOString().slice(0, 10) // YYYY-MM-DD
          break
        default:
          timeKey = timestamp.toISOString()
      }

      if (!acc[timeKey]) {
        acc[timeKey] = { timestamp: timeKey }
      }

      // Use service_name + metric_type as key for multiple metrics
      const serviceKey = `${metric.service_name}_${metric.metric_type}`
      
      if (!acc[timeKey][serviceKey]) {
        acc[timeKey][serviceKey] = []
      }
      
      acc[timeKey][serviceKey].push(metric.metric_value)

      return acc
    }, {} as Record<string, any>)

    // Calculate averages and format for chart
    return Object.entries(grouped)
      .map(([timestamp, values]) => {
        const entry: any = { timestamp }
        
        Object.entries(values).forEach(([key, metricValues]) => {
          if (key !== 'timestamp' && Array.isArray(metricValues)) {
            // Calculate average for the time period
            const avg = metricValues.reduce((sum: number, val: number) => sum + val, 0) / metricValues.length
            entry[key] = Math.round(avg * 100) / 100 // Round to 2 decimal places
          }
        })
        
        return entry
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [data, granularity])

  // Get unique metric types from data
  const metricTypes = React.useMemo(() => {
    return [...new Set(data.map(d => d.metric_type))]
  }, [data])

  // Get unique services from data
  const services = React.useMemo(() => {
    return [...new Set(data.map(d => d.service_name))]
  }, [data])

  // Create lines for each service-metric combination
  const generateLines = () => {
    const lines: JSX.Element[] = []
    
    services.forEach(service => {
      metricTypes.forEach(metricType => {
        const key = `${service}_${metricType}`
        const color = SERVICE_COLORS[service] || '#6B7280'
        
        // Check if this combination has data
        const hasData = processedData.some(item => item[key] !== undefined)
        if (!hasData) return

        lines.push(
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls={false}
            name={`${service} - ${metricType}`}
          />
        )
      })
    })
    
    return lines
  }

  const formatXAxis = (timestamp: string) => {
    const date = new Date(timestamp)
    switch (granularity) {
      case 'minute':
        return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
      case 'hour':
        return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit' })
      case 'day':
        return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
      default:
        return timestamp
    }
  }

  const formatTooltipValue = (value: number, name: string) => {
    if (!name) return [value, name]
    
    const [service, metricType] = name.split(' - ')
    const unit = METRIC_UNITS[metricType as keyof typeof METRIC_UNITS] || ''
    
    return [`${value}${unit}`, `${service} - ${metricType}`]
  }

  const formatTooltipLabel = (timestamp: string) => {
    const date = new Date(timestamp)
    switch (granularity) {
      case 'minute':
        return date.toLocaleString('sv-SE', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      case 'hour':
        return date.toLocaleString('sv-SE', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit' 
        })
      case 'day':
        return date.toLocaleDateString('sv-SE', { 
          weekday: 'short',
          month: 'short', 
          day: 'numeric' 
        })
      default:
        return timestamp
    }
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-2">📊</div>
          <p className="text-gray-500">No metrics data available</p>
          <p className="text-sm text-gray-400">Try adjusting your filters or time range</p>
        </div>
      </div>
    )
  }

  if (processedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-2">⚠️</div>
          <p className="text-gray-500">No data points found</p>
          <p className="text-sm text-gray-400">The selected time range may not contain any metrics</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={processedData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="timestamp"
            tickFormatter={formatXAxis}
            stroke="#6B7280"
            fontSize={12}
          />
          <YAxis 
            stroke="#6B7280"
            fontSize={12}
          />
          <Tooltip
            formatter={formatTooltipValue}
            labelFormatter={formatTooltipLabel}
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
          />
          {generateLines()}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Export as default for dynamic imports
export default MetricsChart