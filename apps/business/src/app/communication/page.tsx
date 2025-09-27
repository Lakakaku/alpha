'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MessageSquare, 
  Settings, 
  Phone, 
  Mail, 
  Bell, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Users,
  Calendar,
  BarChart3
} from 'lucide-react';
import CommunicationPreferences from '@/components/communication/CommunicationPreferences';
import SupportContact from '@/components/communication/SupportContact';

interface CommunicationStats {
  notifications_sent_today: number;
  notifications_sent_week: number;
  average_response_time_hours: number;
  active_support_tickets: number;
  pending_verifications: number;
  overdue_payments: number;
  last_notification_sent: string;
  delivery_success_rate: number;
}

interface RecentNotification {
  id: string;
  type: 'verification_request' | 'payment_invoice' | 'payment_reminder' | 'system_alert';
  title: string;
  content: string;
  sent_at: string;
  status: 'sent' | 'delivered' | 'failed' | 'read';
  channels: ('sms' | 'email' | 'push')[];
}

interface SystemStatus {
  sms_service: 'operational' | 'degraded' | 'down';
  email_service: 'operational' | 'degraded' | 'down';
  verification_system: 'operational' | 'degraded' | 'down';
  payment_system: 'operational' | 'degraded' | 'down';
  last_updated: string;
}

const notificationTypeConfig = {
  verification_request: {
    label: 'Verifieringsbegäran',
    color: 'bg-blue-100 text-blue-700',
    icon: CheckCircle
  },
  payment_invoice: {
    label: 'Faktura',
    color: 'bg-green-100 text-green-700',
    icon: BarChart3
  },
  payment_reminder: {
    label: 'Betalningspåminnelse',
    color: 'bg-orange-100 text-orange-700',
    icon: Clock
  },
  system_alert: {
    label: 'Systemmeddelande',
    color: 'bg-red-100 text-red-700',
    icon: AlertTriangle
  }
};

const statusConfig = {
  sent: { label: 'Skickad', color: 'bg-blue-100 text-blue-700' },
  delivered: { label: 'Levererad', color: 'bg-green-100 text-green-700' },
  failed: { label: 'Misslyckades', color: 'bg-red-100 text-red-700' },
  read: { label: 'Läst', color: 'bg-gray-100 text-gray-700' }
};

const systemStatusConfig = {
  operational: { label: 'Operativ', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  degraded: { label: 'Försämrad', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  down: { label: 'Nere', color: 'bg-red-100 text-red-700', icon: AlertTriangle }
};

export default function CommunicationPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<CommunicationStats>({
    notifications_sent_today: 0,
    notifications_sent_week: 0,
    average_response_time_hours: 0,
    active_support_tickets: 0,
    pending_verifications: 0,
    overdue_payments: 0,
    last_notification_sent: '',
    delivery_success_rate: 0
  });
  const [recentNotifications, setRecentNotifications] = useState<RecentNotification[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    sms_service: 'operational',
    email_service: 'operational',
    verification_system: 'operational',
    payment_system: 'operational',
    last_updated: new Date().toISOString()
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCommunicationData();
    const interval = setInterval(fetchCommunicationData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchCommunicationData = async () => {
    try {
      const [statsResponse, notificationsResponse, statusResponse] = await Promise.all([
        fetch('/api/business/communication/stats'),
        fetch('/api/business/communication/notifications/recent'),
        fetch('/api/business/communication/system-status')
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (notificationsResponse.ok) {
        const notificationsData = await notificationsResponse.json();
        setRecentNotifications(notificationsData);
      }

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setSystemStatus(statusData);
      }
    } catch (error) {
      console.error('Failed to fetch communication data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Aldrig';
    return new Date(dateString).toLocaleString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getOverallSystemHealth = () => {
    const services = [
      systemStatus.sms_service,
      systemStatus.email_service,
      systemStatus.verification_system,
      systemStatus.payment_system
    ];

    if (services.every(s => s === 'operational')) return 'operational';
    if (services.some(s => s === 'down')) return 'down';
    return 'degraded';
  };

  const overallHealth = getOverallSystemHealth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kommunikation</h1>
          <p className="text-gray-600">Hantera notifikationer, support och kommunikationsinställningar</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={systemStatusConfig[overallHealth].color}>
            {systemStatusConfig[overallHealth].label}
          </Badge>
          <span className="text-sm text-gray-500">
            Uppdaterad: {formatDate(systemStatus.last_updated)}
          </span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Översikt</TabsTrigger>
          <TabsTrigger value="notifications">Notifikationer</TabsTrigger>
          <TabsTrigger value="settings">Inställningar</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Idag</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.notifications_sent_today}</p>
                    <p className="text-xs text-gray-500">meddelanden</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Denna vecka</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.notifications_sent_week}</p>
                    <p className="text-xs text-gray-500">meddelanden</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Clock className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Svarstid</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.average_response_time_hours}h</p>
                    <p className="text-xs text-gray-500">i genomsnitt</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Users className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Aktiva ärenden</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.active_support_tickets}</p>
                    <p className="text-xs text-gray-500">support</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Systemstatus</span>
              </CardTitle>
              <CardDescription>
                Aktuell status för kommunikationssystem och tjänster
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">SMS-tjänst</span>
                  </div>
                  <Badge className={systemStatusConfig[systemStatus.sms_service].color}>
                    {systemStatusConfig[systemStatus.sms_service].label}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">E-post</span>
                  </div>
                  <Badge className={systemStatusConfig[systemStatus.email_service].color}>
                    {systemStatusConfig[systemStatus.email_service].label}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">Verifiering</span>
                  </div>
                  <Badge className={systemStatusConfig[systemStatus.verification_system].color}>
                    {systemStatusConfig[systemStatus.verification_system].label}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">Betalningar</span>
                  </div>
                  <Badge className={systemStatusConfig[systemStatus.payment_system].color}>
                    {systemStatusConfig[systemStatus.payment_system].label}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Important Alerts */}
          {(stats.pending_verifications > 0 || stats.overdue_payments > 0) && (
            <div className="space-y-3">
              {stats.pending_verifications > 0 && (
                <Alert className="border-orange-200 bg-orange-50">
                  <Calendar className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{stats.pending_verifications} väntande verifieringar</strong> - 
                    Se till att granska och returnera databaserna inom tidsfristen.
                  </AlertDescription>
                </Alert>
              )}

              {stats.overdue_payments > 0 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{stats.overdue_payments} försenade betalningar</strong> - 
                    Kontakta ekonomiavdelningen för att undvika störningar i tjänsten.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Delivery Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Leveransstatistik</CardTitle>
              <CardDescription>
                Senaste 30 dagarna
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-green-600">{stats.delivery_success_rate}%</p>
                  <p className="text-sm text-gray-600">Leveransfrekvens</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Senaste meddelande</p>
                  <p className="text-sm font-medium">{formatDate(stats.last_notification_sent)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Senaste notifikationer</CardTitle>
              <CardDescription>
                Översikt över skickade meddelanden och leveransstatus
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentNotifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Inga notifikationer</h3>
                  <p className="text-gray-600">Inga meddelanden har skickats ännu</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentNotifications.map((notification) => {
                    const typeConfig = notificationTypeConfig[notification.type];
                    const Icon = typeConfig.icon;
                    
                    return (
                      <div key={notification.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              <Icon className="h-4 w-4 text-gray-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h4 className="font-medium text-gray-900">{notification.title}</h4>
                                <Badge className={typeConfig.color}>
                                  {typeConfig.label}
                                </Badge>
                                <Badge variant="outline" className={statusConfig[notification.status].color}>
                                  {statusConfig[notification.status].label}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{notification.content}</p>
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <span>Skickad: {formatDate(notification.sent_at)}</span>
                                <span>
                                  Kanaler: {notification.channels.map(ch => 
                                    ch === 'sms' ? 'SMS' : ch === 'email' ? 'E-post' : 'Push'
                                  ).join(', ')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <CommunicationPreferences />
        </TabsContent>

        <TabsContent value="support" className="space-y-6">
          <SupportContact />
        </TabsContent>
      </Tabs>
    </div>
  );
}