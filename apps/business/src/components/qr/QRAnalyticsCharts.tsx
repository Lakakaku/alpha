'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
// TODO: Add Tabs and Select components to @vocilia/ui
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vocilia/ui';
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vocilia/ui';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Users, 
  Clock, 
  MapPin,
  Smartphone,
  Calendar,
  Filter
} from 'lucide-react';
import { QRAnalytics, QRScanEvent } from '@vocilia/types';
import { cn } from '@/lib/utils';

interface QRAnalyticsChartsProps {
  analytics: QRAnalytics[];
  scanEvents?: QRScanEvent[];
  storeId?: string;
  dateRange?: 'today' | 'week' | 'month' | 'quarter' | 'year';
  className?: string;
  onDateRangeChange?: (range: string) => void;
  onExportData?: (type: 'csv' | 'json') => Promise<void>;
}

/**
 * QR Analytics Charts Component
 * 
 * Comprehensive analytics visualization for QR code performance.
 * Includes multiple chart types and interactive filtering options.
 * 
 * Features:
 * - Multiple chart types (line, area, bar, pie)
 * - Time-based analytics (hourly, daily, weekly)
 * - Device and location breakdown
 * - Real-time updates
 * - Export functionality
 * - Responsive design
 */
export function QRAnalyticsCharts({
  analytics = [],
  scanEvents = [],
  storeId,
  dateRange = 'week',
  className,
  onDateRangeChange,
  onExportData
}: QRAnalyticsChartsProps) {
  const [selectedMetric, setSelectedMetric] = useState<'scans' | 'unique' | 'conversion'>('scans');
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('line');

  // Process analytics data for charts
  const chartData = useMemo(() => {
    if (!analytics.length) return [];

    return analytics.map(item => ({
      date: new Date(item.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(dateRange === 'year' && { year: '2-digit' })
      }),
      timestamp: item.timestamp,
      scans: item.totalScans,
      unique: item.uniqueScans,
      conversion: item.conversionRate || 0,
      avgDuration: item.avgSessionDuration || 0
    }));
  }, [analytics, dateRange]);

  // Device breakdown data
  const deviceData = useMemo(() => {
    const devices: Record<string, number> = {};
    scanEvents.forEach(event => {
      const deviceType = event.deviceInfo?.platform || 'Unknown';
      devices[deviceType] = (devices[deviceType] || 0) + 1;
    });

    return Object.entries(devices).map(([name, value]) => ({
      name,
      value,
      percentage: Math.round((value / scanEvents.length) * 100)
    }));
  }, [scanEvents]);

  // Hourly distribution data
  const hourlyData = useMemo(() => {
    const hours: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hours[i] = 0;

    scanEvents.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hours[hour]++;
    });

    return Object.entries(hours).map(([hour, scans]) => ({
      hour: `${hour}:00`,
      scans,
      label: new Date().setHours(parseInt(hour), 0, 0, 0)
    }));
  }, [scanEvents]);

  // Calculate key metrics
  const totalScans = analytics.reduce((sum, item) => sum + item.totalScans, 0);
  const uniqueScans = analytics.reduce((sum, item) => sum + item.uniqueScans, 0);
  const avgConversion = analytics.length > 0 
    ? analytics.reduce((sum, item) => sum + (item.conversionRate || 0), 0) / analytics.length 
    : 0;

  // Calculate trends
  const getTrend = (data: number[]) => {
    if (data.length < 2) return { direction: 'neutral', percentage: 0 };
    const recent = data.slice(-7).reduce((sum, val) => sum + val, 0) / 7;
    const previous = data.slice(-14, -7).reduce((sum, val) => sum + val, 0) / 7;
    const change = ((recent - previous) / previous) * 100;
    return {
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
      percentage: Math.abs(change)
    };
  };

  const scansTrend = getTrend(analytics.map(a => a.totalScans));
  const uniqueTrend = getTrend(analytics.map(a => a.uniqueScans));

  // Chart colors
  const colors = {
    primary: '#3b82f6',
    secondary: '#10b981',
    accent: '#f59e0b',
    danger: '#ef4444',
    muted: '#6b7280'
  };

  const deviceColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const formatTooltip = (value: any, name: string) => {
    if (name === 'conversion') return [`${value.toFixed(1)}%`, 'Conversion Rate'];
    if (name === 'avgDuration') return [`${Math.round(value)}s`, 'Avg Duration'];
    return [value.toLocaleString(), name === 'scans' ? 'Total Scans' : 'Unique Scans'];
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">QR Code Analytics</h2>
          <p className="text-gray-600">Performance metrics and insights</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={dateRange} onValueChange={onDateRangeChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>

          <Select value={chartType} onValueChange={(value: 'line' | 'area' | 'bar') => setChartType(value)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="line">Line</SelectItem>
              <SelectItem value="area">Area</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
            </SelectContent>
          </Select>

          {onExportData && (
            <Button variant="outline" size="sm" onClick={() => onExportData('csv')}>
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Scans</p>
                <p className="text-2xl font-bold">{totalScans.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1">
                  {scansTrend.direction === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : scansTrend.direction === 'down' ? (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  ) : null}
                  <span className={cn(
                    "text-xs",
                    scansTrend.direction === 'up' ? "text-green-600" : 
                    scansTrend.direction === 'down' ? "text-red-600" : "text-gray-500"
                  )}>
                    {scansTrend.percentage > 0 && `${scansTrend.percentage.toFixed(1)}%`}
                  </span>
                </div>
              </div>
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unique Visitors</p>
                <p className="text-2xl font-bold">{uniqueScans.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-1">
                  {uniqueTrend.direction === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : uniqueTrend.direction === 'down' ? (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  ) : null}
                  <span className={cn(
                    "text-xs",
                    uniqueTrend.direction === 'up' ? "text-green-600" : 
                    uniqueTrend.direction === 'down' ? "text-red-600" : "text-gray-500"
                  )}>
                    {uniqueTrend.percentage > 0 && `${uniqueTrend.percentage.toFixed(1)}%`}
                  </span>
                </div>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Conversion Rate</p>
                <p className="text-2xl font-bold">{avgConversion.toFixed(1)}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {uniqueScans > 0 ? `${((totalScans / uniqueScans) * 100).toFixed(1)}% repeat rate` : 'No data'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="hourly">Hourly</TabsTrigger>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="real-time">Real-time</TabsTrigger>
        </TabsList>

        {/* Trends Chart */}
        <TabsContent value="trends">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Scan Trends</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={selectedMetric === 'scans' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedMetric('scans')}
                >
                  Total Scans
                </Button>
                <Button
                  variant={selectedMetric === 'unique' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedMetric('unique')}
                >
                  Unique
                </Button>
                <Button
                  variant={selectedMetric === 'conversion' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedMetric('conversion')}
                >
                  Conversion
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                {chartType === 'line' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={formatTooltip} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey={selectedMetric} 
                      stroke={colors.primary} 
                      strokeWidth={2}
                      dot={{ fill: colors.primary, strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                ) : chartType === 'area' ? (
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={formatTooltip} />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey={selectedMetric} 
                      stroke={colors.primary} 
                      fill={colors.primary}
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={formatTooltip} />
                    <Legend />
                    <Bar dataKey={selectedMetric} fill={colors.primary} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hourly Distribution */}
        <TabsContent value="hourly">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Hourly Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="scans" fill={colors.secondary} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Device Breakdown */}
        <TabsContent value="devices">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Device Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={deviceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {deviceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={deviceColors[index % deviceColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Device Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {deviceData.map((device, index) => (
                  <div key={device.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: deviceColors[index % deviceColors.length] }}
                      />
                      <span className="font-medium">{device.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold">{device.value}</span>
                      <span className="text-sm text-gray-600 ml-2">({device.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Real-time Activity */}
        <TabsContent value="real-time">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Real-time Activity
                <Badge variant="outline" className="ml-2">Live</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scanEvents.slice(0, 10).map((event, index) => (
                  <div key={event.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <div>
                        <p className="font-medium">New scan detected</p>
                        <p className="text-sm text-gray-600">
                          {event.deviceInfo?.platform || 'Unknown device'} • 
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    {event.geolocation && (
                      <MapPin className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                ))}
                
                {scanEvents.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default QRAnalyticsCharts;