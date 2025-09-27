'use client'

import { useState, useEffect } from 'react'
import { RevenueChart } from './charts/RevenueChart'
import { PerformanceChart } from './charts/PerformanceChart'

interface FraudDetectionReport {
  id: string
  report_date: string
  store_id: string
  verification_failure_rate: number
  suspicious_patterns: Record<string, any>
  blocked_transactions: number
  false_positive_rate?: number
  accuracy_metrics: Record<string, any>
}

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

interface RevenueSummary {
  total_revenue: number
  period_growth: number
  top_performing_stores: {
    store_id: string
    store_name: string
    revenue: number
  }[]
}

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

export default function BusinessIntelligenceDashboard() {
  const [fraudReports, setFraudReports] = useState<FraudDetectionReport[]>([])
  const [revenueAnalytics, setRevenueAnalytics] = useState<RevenueAnalytics[]>([])
  const [revenueSummary, setRevenueSummary] = useState<RevenueSummary | null>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<BusinessPerformanceMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Filter states
  const [filters, setFilters] = useState({
    store_id: '',
    business_type: '',
    region: '',
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end_date: new Date().toISOString().split('T')[0],
    group_by: 'day' as 'day' | 'week' | 'month',
    comparison_period: 'month' as 'week' | 'month' | 'quarter'
  })

  // Active tab
  const [activeTab, setActiveTab] = useState<'fraud' | 'revenue' | 'performance'>('fraud')

  useEffect(() => {
    fetchBusinessIntelligenceData()
  }, [filters])

  const fetchBusinessIntelligenceData = async () => {
    try {
      setLoading(true)
      setError('')

      // Fetch fraud detection reports
      const fraudParams = new URLSearchParams({
        start_date: filters.start_date,
        end_date: filters.end_date
      })
      if (filters.store_id) fraudParams.append('store_id', filters.store_id)

      // Fetch revenue analytics
      const revenueParams = new URLSearchParams({
        start_date: filters.start_date,
        end_date: filters.end_date,
        group_by: filters.group_by
      })
      if (filters.store_id) revenueParams.append('store_id', filters.store_id)
      if (filters.business_type) revenueParams.append('business_type', filters.business_type)

      // Fetch business performance metrics
      const performanceParams = new URLSearchParams({
        comparison_period: filters.comparison_period
      })
      if (filters.store_id) performanceParams.append('store_id', filters.store_id)
      if (filters.region) performanceParams.append('region', filters.region)

      const [fraudResponse, revenueResponse, performanceResponse] = await Promise.all([
        fetch(`/api/monitoring/fraud-reports?${fraudParams}`),
        fetch(`/api/monitoring/revenue-analytics?${revenueParams}`),
        fetch(`/api/monitoring/business-performance?${performanceParams}`)
      ])

      if (fraudResponse.ok) {
        const fraudData = await fraudResponse.json()
        setFraudReports(fraudData.reports || [])
      }

      if (revenueResponse.ok) {
        const revenueData = await revenueResponse.json()
        setRevenueAnalytics(revenueData.analytics || [])
        setRevenueSummary(revenueData.summary || null)
      }

      if (performanceResponse.ok) {
        const performanceData = await performanceResponse.json()
        setPerformanceMetrics(performanceData.metrics || [])
      }

      if (!fraudResponse.ok && !revenueResponse.ok && !performanceResponse.ok) {
        setError('Failed to fetch business intelligence data')
      }
    } catch (err) {
      setError('Network error while fetching business intelligence data')
      console.error('BI fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK'
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  const getTrendIcon = (value?: number) => {
    if (value === undefined) return '➡️'
    if (value > 0) return '📈'
    if (value < 0) return '📉'
    return '➡️'
  }

  const getTrendColor = (value?: number) => {
    if (value === undefined) return 'text-gray-600'
    if (value > 0) return 'text-green-600'
    if (value < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Business Intelligence</h1>
          <p className="text-gray-600">Fraud detection, revenue analytics, and business performance insights</p>
        </div>
        <button
          onClick={fetchBusinessIntelligenceData}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          🔄 Refresh Data
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label htmlFor="store-id" className="block text-sm font-medium text-gray-700 mb-1">
              Store ID
            </label>
            <input
              id="store-id"
              type="text"
              value={filters.store_id}
              onChange={(e) => handleFilterChange('store_id', e.target.value)}
              placeholder="Filter by store"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="business-type" className="block text-sm font-medium text-gray-700 mb-1">
              Business Type
            </label>
            <select
              id="business-type"
              value={filters.business_type}
              onChange={(e) => handleFilterChange('business_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="restaurant">Restaurant</option>
              <option value="retail">Retail</option>
              <option value="service">Service</option>
              <option value="healthcare">Healthcare</option>
            </select>
          </div>

          <div>
            <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
              Region
            </label>
            <select
              id="region"
              value={filters.region}
              onChange={(e) => handleFilterChange('region', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Regions</option>
              <option value="stockholm">Stockholm</option>
              <option value="gothenburg">Gothenburg</option>
              <option value="malmo">Malmö</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange('start_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange('end_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="group-by" className="block text-sm font-medium text-gray-700 mb-1">
              Group By
            </label>
            <select
              id="group-by"
              value={filters.group_by}
              onChange={(e) => handleFilterChange('group_by', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('fraud')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'fraud'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Fraud Detection
            </button>
            <button
              onClick={() => setActiveTab('revenue')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'revenue'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Revenue Analytics
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'performance'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Business Performance
            </button>
          </nav>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading business intelligence data...</span>
            </div>
          ) : (
            <>
              {/* Fraud Detection Tab */}
              {activeTab === 'fraud' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Fraud Detection Reports</h3>
                  
                  {fraudReports.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No fraud detection data available for the selected period
                    </div>
                  ) : (
                    <>
                      {/* Fraud Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-red-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-red-600">
                            {fraudReports.reduce((sum, report) => sum + report.blocked_transactions, 0)}
                          </div>
                          <div className="text-sm text-gray-600">Blocked Transactions</div>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-yellow-600">
                            {formatPercentage(fraudReports.reduce((sum, report) => sum + report.verification_failure_rate, 0) / fraudReports.length)}
                          </div>
                          <div className="text-sm text-gray-600">Avg Failure Rate</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {fraudReports.filter(r => r.false_positive_rate && r.false_positive_rate < 0.1).length}
                          </div>
                          <div className="text-sm text-gray-600">High Accuracy Stores</div>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {fraudReports.length}
                          </div>
                          <div className="text-sm text-gray-600">Total Reports</div>
                        </div>
                      </div>

                      {/* Fraud Reports Table */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Date
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Store ID
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Failure Rate
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Blocked
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                False Positive Rate
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {fraudReports.map((report) => (
                              <tr key={report.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {new Date(report.report_date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {report.store_id.slice(0, 8)}...
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    report.verification_failure_rate > 0.2 ? 'bg-red-100 text-red-800' :
                                    report.verification_failure_rate > 0.1 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                  }`}>
                                    {formatPercentage(report.verification_failure_rate)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {report.blocked_transactions}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {report.false_positive_rate ? formatPercentage(report.false_positive_rate) : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Revenue Analytics Tab */}
              {activeTab === 'revenue' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Revenue Analytics</h3>
                  
                  {/* Revenue Summary */}
                  {revenueSummary && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(revenueSummary.total_revenue)}
                        </div>
                        <div className="text-sm text-gray-600">Total Revenue</div>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className={`text-2xl font-bold ${getTrendColor(revenueSummary.period_growth)}`}>
                          {getTrendIcon(revenueSummary.period_growth)} {formatPercentage(Math.abs(revenueSummary.period_growth))}
                        </div>
                        <div className="text-sm text-gray-600">Period Growth</div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          {revenueSummary.top_performing_stores.length}
                        </div>
                        <div className="text-sm text-gray-600">Top Stores</div>
                      </div>
                    </div>
                  )}

                  {/* Revenue Chart */}
                  {revenueAnalytics.length > 0 && (
                    <div className="h-80">
                      <RevenueChart 
                        data={revenueAnalytics}
                        groupBy={filters.group_by}
                        height={320}
                      />
                    </div>
                  )}

                  {/* Top Performing Stores */}
                  {revenueSummary?.top_performing_stores && revenueSummary.top_performing_stores.length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold mb-3">Top Performing Stores</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {revenueSummary.top_performing_stores.slice(0, 3).map((store, index) => (
                          <div key={store.store_id} className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-lg font-semibold text-gray-900">
                                  #{index + 1} {store.store_name || `Store ${store.store_id.slice(0, 8)}`}
                                </div>
                                <div className="text-sm text-gray-600">{formatCurrency(store.revenue)}</div>
                              </div>
                              <div className="text-2xl">
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Business Performance Tab */}
              {activeTab === 'performance' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Business Performance Metrics</h3>
                  
                  {performanceMetrics.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No performance data available for the selected criteria
                    </div>
                  ) : (
                    <>
                      {/* Performance Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {formatPercentage(performanceMetrics.reduce((sum, m) => sum + (m.verification_rate || 0), 0) / performanceMetrics.length)}
                          </div>
                          <div className="text-sm text-gray-600">Avg Verification Rate</div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {(performanceMetrics.reduce((sum, m) => sum + (m.customer_satisfaction_score || 0), 0) / performanceMetrics.length).toFixed(1)}
                          </div>
                          <div className="text-sm text-gray-600">Avg Satisfaction</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {formatPercentage(Math.abs(performanceMetrics.reduce((sum, m) => sum + (m.feedback_volume_trend || 0), 0) / performanceMetrics.length))}
                          </div>
                          <div className="text-sm text-gray-600">Avg Volume Trend</div>
                        </div>
                        <div className="bg-yellow-50 p-4 rounded-lg">
                          <div className="text-2xl font-bold text-yellow-600">
                            {performanceMetrics.length}
                          </div>
                          <div className="text-sm text-gray-600">Total Stores</div>
                        </div>
                      </div>

                      {/* Performance Chart */}
                      <div className="h-80">
                        <PerformanceChart 
                          data={performanceMetrics}
                          height={320}
                        />
                      </div>

                      {/* Performance Table */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Store ID
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Verification Rate
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Customer Satisfaction
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Volume Trend
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Report Date
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {performanceMetrics.map((metric) => (
                              <tr key={metric.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {metric.store_id.slice(0, 8)}...
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {metric.verification_rate ? formatPercentage(metric.verification_rate) : 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    !metric.customer_satisfaction_score ? 'bg-gray-100 text-gray-800' :
                                    metric.customer_satisfaction_score >= 4.5 ? 'bg-green-100 text-green-800' :
                                    metric.customer_satisfaction_score >= 3.5 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {metric.customer_satisfaction_score ? metric.customer_satisfaction_score.toFixed(1) : 'N/A'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <span className={getTrendColor(metric.feedback_volume_trend)}>
                                    {getTrendIcon(metric.feedback_volume_trend)}
                                    {metric.feedback_volume_trend ? formatPercentage(Math.abs(metric.feedback_volume_trend)) : 'N/A'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {new Date(metric.report_date).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}