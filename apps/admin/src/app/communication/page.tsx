'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MessageSquare, 
  Mail, 
  Phone, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Users, 
  Building,
  BarChart3,
  PieChart,
  Calendar,
  Settings,
  Refresh
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, BarChart, Bar } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import NotificationDashboard from '@/components/communication/NotificationDashboard';
import SupportTicketList from '@/components/communication/SupportTicketList';
import TemplateManager from '@/components/communication/TemplateManager';

interface CommunicationOverview {
  notifications: {
    total_sent_today: number;
    total_sent_week: number;
    delivery_rate_today: number;
    delivery_rate_week: number;
    failed_deliveries_today: number;
    pending_retries: number;
    avg_delivery_time_seconds: number;
    sms_sent_today: number;
    email_sent_today: number;
    cost_today_sek: number;
    cost_week_sek: number;
  };
  support: {
    open_tickets: number;
    tickets_created_today: number;
    tickets_resolved_today: number;
    avg_response_time_hours: number;
    sla_compliance_rate: number;
    overdue_tickets: number;
    escalated_tickets: number;
    customer_satisfaction: number;
  };
  templates: {
    total_templates: number;
    active_templates: number;
    templates_used_today: number;
    most_used_template: string;
    avg_template_usage: number;
    template_errors_today: number;
  };
  system: {
    sms_provider_status: 'operational' | 'degraded' | 'outage';
    email_provider_status: 'operational' | 'degraded' | 'outage';
    webhook_health: number;
    queue_length: number;
    processing_lag_seconds: number;
    last_health_check: string;
  };
}

interface MetricsTrend {
  date: string;
  notifications_sent: number;
  delivery_rate: number;
  support_tickets: number;
  response_time: number;
  cost_sek: number;
}

interface ChannelDistribution {
  name: string;
  value: number;
  color: string;
}

interface RecentActivity {
  id: string;
  type: 'notification' | 'support' | 'template' | 'system';
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'success';
}

const statusConfig = {
  operational: { label: 'Operationell', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  degraded: { label: 'Försämrad', color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
  outage: { label: 'Avbrott', color: 'bg-red-100 text-red-800', icon: XCircle }
};

const severityConfig = {
  info: { color: 'bg-blue-100 text-blue-800', icon: Activity },
  success: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  warning: { color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
  error: { color: 'bg-red-100 text-red-800', icon: XCircle }
};

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

export default function CommunicationPage() {
  const [overview, setOverview] = useState<CommunicationOverview | null>(null);
  const [trends, setTrends] = useState<MetricsTrend[]>([]);
  const [channelDistribution, setChannelDistribution] = useState<ChannelDistribution[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadOverview();
    loadTrends();
    loadChannelDistribution();
    loadRecentActivity();

    const interval = autoRefresh ? setInterval(() => {
      loadOverview();
      loadRecentActivity();
      setLastRefresh(new Date());
    }, 30000) : null; // Refresh every 30 seconds

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/communication/overview');
      if (!response.ok) throw new Error('Failed to load overview');
      
      const data = await response.json();
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  };

  const loadTrends = async () => {
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, 7);
      
      const response = await fetch(`/api/admin/communication/trends?start=${startDate.toISOString()}&end=${endDate.toISOString()}`);
      if (!response.ok) throw new Error('Failed to load trends');
      
      const data = await response.json();
      setTrends(data.trends || []);
    } catch (err) {
      console.error('Failed to load trends:', err);
    }
  };

  const loadChannelDistribution = async () => {
    try {
      const response = await fetch('/api/admin/communication/channel-distribution');
      if (!response.ok) throw new Error('Failed to load channel distribution');
      
      const data = await response.json();
      setChannelDistribution([
        { name: 'SMS', value: data.sms || 0, color: '#3B82F6' },
        { name: 'E-post', value: data.email || 0, color: '#10B981' },
        { name: 'Push', value: data.push || 0, color: '#F59E0B' }
      ]);
    } catch (err) {
      console.error('Failed to load channel distribution:', err);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const response = await fetch('/api/admin/communication/activity?limit=10');
      if (!response.ok) throw new Error('Failed to load recent activity');
      
      const data = await response.json();
      setRecentActivity(data.activities || []);
    } catch (err) {
      console.error('Failed to load recent activity:', err);
    }
  };

  const handleRefresh = async () => {
    await loadOverview();
    await loadTrends();
    await loadChannelDistribution();
    await loadRecentActivity();
    setLastRefresh(new Date());
  };

  const formatMetric = (value: number, type: 'percentage' | 'currency' | 'time' | 'number' = 'number') => {
    if (type === 'percentage') return `${value.toFixed(1)}%`;
    if (type === 'currency') return `${value.toFixed(2)} SEK`;
    if (type === 'time') return `${value.toFixed(1)}s`;
    return value.toLocaleString();
  };

  const getMetricTrend = (current: number, previous: number) => {
    if (previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      direction: change > 0 ? 'up' : 'down',
      percentage: Math.abs(change).toFixed(1),
      color: change > 0 ? 'text-green-600' : 'text-red-600',
      icon: change > 0 ? TrendingUp : TrendingDown
    };
  };

  if (loading && !overview) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="text-lg font-medium">Laddar kommunikationsöversikt...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kommunikationssystem</h1>
          <p className="text-gray-600 mt-1">
            Översikt över SMS-notifikationer, support och mallar
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-sm text-gray-500">
            Senast uppdaterad: {format(lastRefresh, 'HH:mm:ss')}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'text-green-600' : ''}`} />
            {autoRefresh ? 'Auto' : 'Manuell'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <Refresh className="h-4 w-4 mr-2" />
            Uppdatera
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* System Status */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">SMS-tjänst</p>
                  <Badge className={statusConfig[overview.system.sms_provider_status].color}>
                    {statusConfig[overview.system.sms_provider_status].label}
                  </Badge>
                </div>
                <MessageSquare className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">E-posttjänst</p>
                  <Badge className={statusConfig[overview.system.email_provider_status].color}>
                    {statusConfig[overview.system.email_provider_status].label}
                  </Badge>
                </div>
                <Mail className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Kölängd</p>
                  <p className="text-2xl font-bold">{overview.system.queue_length}</p>
                </div>
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Key Metrics */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Notifikationer idag</p>
                  <p className="text-2xl font-bold">{formatMetric(overview.notifications.total_sent_today)}</p>
                  <p className="text-sm text-gray-500">
                    {formatMetric(overview.notifications.delivery_rate_today, 'percentage')} leveransgrad
                  </p>
                </div>
                <MessageSquare className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Supportärenden</p>
                  <p className="text-2xl font-bold">{formatMetric(overview.support.open_tickets)}</p>
                  <p className="text-sm text-gray-500">
                    {formatMetric(overview.support.overdue_tickets)} försenade
                  </p>
                </div>
                <Phone className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">SLA-efterlevnad</p>
                  <p className="text-2xl font-bold">{formatMetric(overview.support.sla_compliance_rate, 'percentage')}</p>
                  <p className="text-sm text-gray-500">
                    {formatMetric(overview.support.avg_response_time_hours)} h snitt
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Kostnad idag</p>
                  <p className="text-2xl font-bold">{formatMetric(overview.notifications.cost_today_sek, 'currency')}</p>
                  <p className="text-sm text-gray-500">
                    {formatMetric(overview.notifications.cost_week_sek, 'currency')} denna vecka
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Trender (7 dagar)</CardTitle>
            <CardDescription>Notifikationer och leveransgrad över tid</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => format(new Date(value), 'MM/dd')}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  labelFormatter={(value) => format(new Date(value), 'PPP', { locale: sv })}
                  formatter={(value, name) => [
                    name === 'delivery_rate' ? `${value}%` : value,
                    name === 'notifications_sent' ? 'Skickade' : 
                    name === 'delivery_rate' ? 'Leveransgrad' : name
                  ]}
                />
                <Line yAxisId="left" type="monotone" dataKey="notifications_sent" stroke="#3B82F6" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="delivery_rate" stroke="#10B981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Channel Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Kanalfördelning</CardTitle>
            <CardDescription>Notifikationer per kommunikationskanal idag</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <RechartsPieChart
                  data={channelDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {channelDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </RechartsPieChart>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Senaste aktivitet</CardTitle>
          <CardDescription>Systemhändelser och aktiviteter</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.map((activity) => {
              const SeverityIcon = severityConfig[activity.severity].icon;
              return (
                <div key={activity.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                  <SeverityIcon className={`h-5 w-5 mt-0.5 ${
                    activity.severity === 'error' ? 'text-red-500' :
                    activity.severity === 'warning' ? 'text-yellow-500' :
                    activity.severity === 'success' ? 'text-green-500' :
                    'text-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(activity.timestamp), 'PPp', { locale: sv })}
                    </p>
                  </div>
                  <Badge className={severityConfig[activity.severity].color}>
                    {activity.type}
                  </Badge>
                </div>
              );
            })}

            {recentActivity.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Ingen nylig aktivitet att visa.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Tabs defaultValue="notifications" className="mt-8">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="notifications">Notifikationer</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
          <TabsTrigger value="templates">Mallar</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-6">
          <NotificationDashboard />
        </TabsContent>

        <TabsContent value="support" className="mt-6">
          <SupportTicketList />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <TemplateManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}