'use client'

import React from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface RevenueAnalytics {
  id: string
  report_date: string
  store_id: string
  total_rewards_paid: number
  admin_fees_collected: number
  net_revenue: number
  feedback_volume: number
  customer_engagement_rate?: number
  reward_distribution: Record<string, any>
}

interface RevenueChartProps {
  data: RevenueAnalytics[]
  groupBy: 'day' | 'week' | 'month'
  height?: number
}

export function RevenueChart({ data, groupBy, height = 400 }: RevenueChartProps) {
  // Transform and aggregate data for charting
  const processedData = React.useMemo(() => {
    if (!data || data.length === 0) return []

    // Group data by date period
    const grouped = data.reduce((acc, item) => {
      const date = new Date(item.report_date)
      let periodKey: string

      switch (groupBy) {
        case 'day':
          periodKey = item.report_date // Use as-is for daily
          break
        case 'week':
          // Get start of week (Monday)
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - (date.getDay() || 7) + 1)
          periodKey = weekStart.toISOString().split('T')[0]
          break
        case 'month':
          periodKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
          break
        default:
          periodKey = item.report_date
      }

      if (!acc[periodKey]) {
        acc[periodKey] = {
          period: periodKey,
          total_rewards_paid: 0,
          admin_fees_collected: 0,
          net_revenue: 0,
          feedback_volume: 0,
          customer_engagement_rate: 0,
          store_count: 0
        }
      }

      acc[periodKey].total_rewards_paid += item.total_rewards_paid
      acc[periodKey].admin_fees_collected += item.admin_fees_collected
      acc[periodKey].net_revenue += item.net_revenue
      acc[periodKey].feedback_volume += item.feedback_volume
      acc[periodKey].customer_engagement_rate += (item.customer_engagement_rate || 0)
      acc[periodKey].store_count += 1

      return acc
    }, {} as Record<string, any>)

    // Calculate averages and format data
    return Object.values(grouped)
      .map((item: any) => ({
        ...item,
        customer_engagement_rate: item.store_count > 0 
          ? Math.round((item.customer_engagement_rate / item.store_count) * 10000) / 100 // Convert to percentage
          : 0,
        // Round monetary values to 2 decimal places
        total_rewards_paid: Math.round(item.total_rewards_paid * 100) / 100,
        admin_fees_collected: Math.round(item.admin_fees_collected * 100) / 100,
        net_revenue: Math.round(item.net_revenue * 100) / 100
      }))
      .sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime())
  }, [data, groupBy])

  const formatXAxis = (period: string) => {
    const date = new Date(period)
    switch (groupBy) {
      case 'day':
        return date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
      case 'week':
        return `Week of ${date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}`
      case 'month':
        return date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short' })
      default:
        return period
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatTooltipValue = (value: number, name: string) => {
    switch (name) {
      case 'total_rewards_paid':
        return [formatCurrency(value), 'Total Rewards Paid']
      case 'admin_fees_collected':
        return [formatCurrency(value), 'Admin Fees Collected']
      case 'net_revenue':
        return [formatCurrency(value), 'Net Revenue']
      case 'feedback_volume':
        return [value.toLocaleString(), 'Feedback Volume']
      case 'customer_engagement_rate':
        return [`${value}%`, 'Customer Engagement Rate']
      default:
        return [value, name]
    }
  }

  const formatTooltipLabel = (period: string) => {
    const date = new Date(period)
    switch (groupBy) {
      case 'day':
        return date.toLocaleDateString('sv-SE', { 
          weekday: 'long',
          year: 'numeric',
          month: 'long', 
          day: 'numeric' 
        })
      case 'week':
        const weekEnd = new Date(date)
        weekEnd.setDate(date.getDate() + 6)
        return `Week: ${date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}`
      case 'month':
        return date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' })
      default:
        return period
    }
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-2">💰</div>
          <p className="text-gray-500">No revenue data available</p>
          <p className="text-sm text-gray-400">Try adjusting your filters or date range</p>
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
          <p className="text-sm text-gray-400">The selected time range may not contain any revenue data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={processedData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="period"
            tickFormatter={formatXAxis}
            stroke="#6B7280"
            fontSize={12}
          />
          <YAxis 
            yAxisId="revenue"
            stroke="#6B7280"
            fontSize={12}
            tickFormatter={(value) => formatCurrency(value)}
          />
          <YAxis 
            yAxisId="volume"
            orientation="right"
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
          
          {/* Revenue bars */}
          <Bar 
            yAxisId="revenue"
            dataKey="total_rewards_paid" 
            fill="#EF4444" 
            name="Total Rewards Paid"
            opacity={0.8}
          />
          <Bar 
            yAxisId="revenue"
            dataKey="admin_fees_collected" 
            fill="#10B981" 
            name="Admin Fees Collected"
            opacity={0.8}
          />
          <Bar 
            yAxisId="revenue"
            dataKey="net_revenue" 
            fill="#3B82F6" 
            name="Net Revenue"
            opacity={0.8}
          />
          
          {/* Feedback volume line */}
          <Line 
            yAxisId="volume"
            type="monotone" 
            dataKey="feedback_volume" 
            stroke="#8B5CF6" 
            strokeWidth={3}
            dot={{ r: 4 }}
            name="Feedback Volume"
          />
          
          {/* Customer engagement rate line */}
          <Line 
            yAxisId="volume"
            type="monotone" 
            dataKey="customer_engagement_rate" 
            stroke="#F59E0B" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 3 }}
            name="Customer Engagement Rate (%)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// Export as default for dynamic imports
export default RevenueChart