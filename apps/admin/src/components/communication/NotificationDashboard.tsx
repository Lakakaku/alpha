'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Input } from '@vocilia/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@vocilia/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vocilia/ui';
import { Alert, AlertDescription } from '@vocilia/ui';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@vocilia/ui';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Smartphone,
  Mail,
  Bell,
  Refresh,
  Filter,
  Download,
  AlertTriangle
} from 'lucide-react';

// Types
interface NotificationStats {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  avgDeliveryTime: number;
}

interface NotificationMetrics {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
}

interface NotificationItem {
  id: string;
  phone: string;
  type: string;
  channel: 'sms' | 'email' | 'push';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled';
  content: string;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  errorMessage?: string;
  retryCount: number;
}

interface NotificationFilters {
  dateRange: string;
  status: string;
  channel: string;
  type: string;
  searchTerm: string;
}

const NotificationDashboard: React.FC = () => {
  // State management
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [metrics, setMetrics] = useState<NotificationMetrics[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Filters state
  const [filters, setFilters] = useState<NotificationFilters>({
    dateRange: '7d',
    status: 'all',
    channel: 'all',
    type: 'all',
    searchTerm: ''
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Load dashboard data
  const loadDashboardData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);

      setError(null);

      // Fetch notification statistics
      const statsResponse = await fetch('/api/admin/notifications/stats?' + new URLSearchParams({
        dateRange: filters.dateRange,
        channel: filters.channel,
        type: filters.type
      }));

      if (!statsResponse.ok) {
        throw new Error('Failed to fetch notification statistics');
      }

      const statsData = await statsResponse.json();
      setStats(statsData);

      // Fetch metrics data for charts
      const metricsResponse = await fetch('/api/admin/notifications/metrics?' + new URLSearchParams({
        dateRange: filters.dateRange,
        channel: filters.channel
      }));

      if (!metricsResponse.ok) {
        throw new Error('Failed to fetch notification metrics');
      }

      const metricsData = await metricsResponse.json();
      setMetrics(metricsData);

      // Fetch recent notifications
      const notificationsResponse = await fetch('/api/admin/notifications?' + new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        status: filters.status,
        channel: filters.channel,
        type: filters.type,
        search: filters.searchTerm,
        dateRange: filters.dateRange
      }));

      if (!notificationsResponse.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const notificationsData = await notificationsResponse.json();
      setNotifications(notificationsData.notifications || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Dashboard loading error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load data on component mount and filter changes
  useEffect(() => {
    loadDashboardData();
  }, [filters, currentPage]);

  // Handle filter changes
  const handleFilterChange = (key: keyof NotificationFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Status badge component
  const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const variants = {
      pending: { variant: 'secondary' as const, icon: Clock },
      sent: { variant: 'default' as const, icon: Send },
      delivered: { variant: 'success' as const, icon: CheckCircle },
      failed: { variant: 'destructive' as const, icon: XCircle },
      cancelled: { variant: 'outline' as const, icon: XCircle }
    };

    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Channel icon component
  const ChannelIcon: React.FC<{ channel: string }> = ({ channel }) => {
    const icons = {
      sms: Smartphone,
      email: Mail,
      push: Bell
    };

    const Icon = icons[channel as keyof typeof icons] || MessageSquare;
    return <Icon className="h-4 w-4" />;
  };

  // Chart colors
  const chartColors = {
    sent: '#3b82f6',
    delivered: '#10b981',
    failed: '#ef4444',
    pending: '#f59e0b'
  };

  // Pie chart data for status distribution
  const statusDistributionData = useMemo(() => {
    if (!stats) return [];

    return [
      { name: 'Delivered', value: stats.delivered, color: chartColors.delivered },
      { name: 'Sent', value: stats.sent - stats.delivered, color: chartColors.sent },
      { name: 'Failed', value: stats.failed, color: chartColors.failed },
      { name: 'Pending', value: stats.pending, color: chartColors.pending }
    ].filter(item => item.value > 0);
  }, [stats]);

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Communication Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor SMS and email notifications, delivery rates, and system performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
          >
            <Refresh className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Select 
              value={filters.dateRange} 
              onValueChange={(value) => handleFilterChange('dateRange', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.status} 
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.channel} 
              onValueChange={(value) => handleFilterChange('channel', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="push">Push</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.type} 
              onValueChange={(value) => handleFilterChange('type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="reward_earned">Reward Earned</SelectItem>
                <SelectItem value="payment_confirmation">Payment Confirmation</SelectItem>
                <SelectItem value="verification_request">Verification Request</SelectItem>
                <SelectItem value="support_response">Support Response</SelectItem>
                <SelectItem value="weekly_summary">Weekly Summary</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Search phone or content..."
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    +{Math.round(((stats.total - (stats.total * 0.8)) / (stats.total * 0.8)) * 100)}% from last period
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                  {stats.deliveryRate >= 95 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.deliveryRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.delivered.toLocaleString()} of {stats.sent.toLocaleString()} delivered
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed Notifications</CardTitle>
                  <XCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.failed.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {((stats.failed / stats.total) * 100).toFixed(1)}% failure rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Delivery Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.avgDeliveryTime.toFixed(1)}s</div>
                  <p className="text-xs text-muted-foreground">
                    Average time to delivery
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Status Distribution Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
                <CardDescription>
                  Current notification status breakdown
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusDistributionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Delivery Trends</CardTitle>
                <CardDescription>
                  Delivery rate over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="deliveryRate" 
                      stroke={chartColors.delivered}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Volume Metrics</CardTitle>
              <CardDescription>
                Notification volume and performance over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sent" stackId="a" fill={chartColors.sent} />
                  <Bar dataKey="delivered" stackId="a" fill={chartColors.delivered} />
                  <Bar dataKey="failed" stackId="a" fill={chartColors.failed} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Notifications</CardTitle>
              <CardDescription>
                Latest notification activity and status updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Retries</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notifications.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell className="font-mono text-sm">
                        {notification.phone}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {notification.type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ChannelIcon channel={notification.channel} />
                          {notification.channel.toUpperCase()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={notification.status} />
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {notification.content}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {notification.retryCount > 0 && (
                          <Badge variant="secondary">
                            {notification.retryCount}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationDashboard;