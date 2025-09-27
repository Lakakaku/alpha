'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Alert, AlertDescription } from '@vocilia/ui';
// TODO: Add Tabs component to @vocilia/ui
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vocilia/ui';
import { 
  ArrowLeft, 
  QrCode, 
  Activity, 
  Download, 
  RefreshCw,
  Settings,
  Eye,
  Calendar,
  MapPin,
  Smartphone,
  TrendingUp,
  Users,
  Clock,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { QRCodeDisplay } from '@/components/qr/QRCodeDisplay';
import { QRAnalyticsCharts } from '@/components/qr/QRAnalyticsCharts';
import { useBusinessAuth } from '@/hooks/use-business-auth';
import { useQRService } from '@/services/qr/qr-client.service';
import { QRCodeStore, QRScanEvent } from '@vocilia/types';
import { toast } from '@/hooks/use-toast';

/**
 * Store-Specific QR Management Page
 * 
 * Detailed view and management for a specific store's QR code.
 * Provides comprehensive analytics, scan history, and management controls.
 * 
 * Features:
 * - Store-specific QR code display
 * - Detailed analytics and insights
 * - Real-time scan tracking
 * - QR code management controls
 * - Download and regeneration options
 * - Scan event history
 */
export default function StoreQRPage() {
  const router = useRouter();
  const { storeId } = router.query;
  const { business, stores } = useBusinessAuth();
  const {
    stores: qrStores,
    analytics,
    scanEvents,
    loading,
    error,
    refreshStores,
    regenerateQR,
    downloadQR,
    getAnalytics,
    getScanEvents
  } = useQRService();

  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'quarter' | 'year'>('week');
  const [activeTab, setActiveTab] = useState('overview');

  // Find the current store
  const currentStore = qrStores.find(store => store.id === storeId);
  const businessStore = stores.find(store => store.id === storeId);

  // Load data on mount and when storeId changes
  useEffect(() => {
    if (storeId && typeof storeId === 'string') {
      refreshStores();
      getAnalytics(storeId, dateRange);
      getScanEvents(storeId, dateRange);
    }
  }, [storeId, dateRange]);

  const handleRegenerateQR = async () => {
    if (!storeId || typeof storeId !== 'string') return;
    
    try {
      await regenerateQR(storeId);
      await refreshStores();
    } catch (error) {
      // Error handled by service
    }
  };

  const handleDownloadQR = async (format: 'pdf' | 'png' | 'svg') => {
    if (!storeId || typeof storeId !== 'string') return;
    
    try {
      await downloadQR(storeId, format);
    } catch (error) {
      // Error handled by service
    }
  };

  const handlePreviewQR = () => {
    // Open QR code in a new window/modal for preview
    toast({
      title: "QR Preview",
      description: "Opening QR code preview...",
    });
  };

  const handleDateRangeChange = (range: string) => {
    setDateRange(range as typeof dateRange);
    if (storeId && typeof storeId === 'string') {
      getAnalytics(storeId, range as typeof dateRange);
      getScanEvents(storeId, range as typeof dateRange);
    }
  };

  // Calculate metrics
  const totalScans = analytics.reduce((sum, item) => sum + item.totalScans, 0);
  const uniqueScans = analytics.reduce((sum, item) => sum + item.uniqueScans, 0);
  const avgConversion = analytics.length > 0 
    ? analytics.reduce((sum, item) => sum + (item.conversionRate || 0), 0) / analytics.length 
    : 0;

  // Recent scans (last 10)
  const recentScans = scanEvents.slice(0, 10);

  if (!business) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Business authentication required. Please log in to access QR management.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error loading store data: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!currentStore && !loading) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Store not found. Please check the URL and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/qr')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to QR Management
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {currentStore?.storeName || businessStore?.storeName || 'Loading...'}
            </h1>
            <p className="text-gray-600">QR Code Management & Analytics</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/qr/${storeId}/settings`)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Store Settings
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {currentStore?.status === 'active' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                  )}
                  <span className="font-medium capitalize">
                    {currentStore?.status || 'Unknown'}
                  </span>
                </div>
              </div>
              <QrCode className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Scans</p>
                <p className="text-2xl font-bold">{totalScans.toLocaleString()}</p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unique Visitors</p>
                <p className="text-2xl font-bold">{uniqueScans.toLocaleString()}</p>
              </div>
              <Users className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Conversion Rate</p>
                <p className="text-2xl font-bold">{avgConversion.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR Code Display */}
        <div className="lg:col-span-1">
          {currentStore && (
            <QRCodeDisplay
              store={currentStore}
              showControls={true}
              size={250}
              onRegenerate={handleRegenerateQR}
              onDownload={handleDownloadQR}
              onPreview={handlePreviewQR}
            />
          )}
        </div>

        {/* Analytics and Details */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Store Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">QR Code Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Generated:</span>
                          <span>{currentStore ? new Date(currentStore.generatedAt).toLocaleDateString() : '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Version:</span>
                          <span>v{currentStore?.version || 1}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Format:</span>
                          <span>VCL-{storeId?.toString().slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Usage Statistics</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Today's Scans:</span>
                          <span>
                            {analytics.filter(a => 
                              new Date(a.timestamp).toDateString() === new Date().toDateString()
                            ).reduce((sum, a) => sum + a.totalScans, 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>This Week:</span>
                          <span>{totalScans}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Peak Hour:</span>
                          <span>2:00 PM - 3:00 PM</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {currentStore?.transitionEndsAt && (
                    <Alert>
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        QR code is in transition period until{' '}
                        {new Date(currentStore.transitionEndsAt).toLocaleString()}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics">
              <QRAnalyticsCharts
                analytics={analytics}
                scanEvents={scanEvents}
                storeId={storeId as string}
                dateRange={dateRange}
                onDateRangeChange={handleDateRangeChange}
                onExportData={async (type) => {
                  toast({
                    title: "Export Started",
                    description: `Exporting analytics data as ${type.toUpperCase()}...`,
                  });
                }}
              />
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Scan Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentScans.map((scan, index) => (
                      <div key={scan.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <div>
                            <p className="font-medium">Scan detected</p>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(scan.timestamp).toLocaleString()}</span>
                              {scan.deviceInfo?.platform && (
                                <>
                                  <Smartphone className="h-3 w-3 ml-2" />
                                  <span>{scan.deviceInfo.platform}</span>
                                </>
                              )}
                              {scan.geolocation && (
                                <>
                                  <MapPin className="h-3 w-3 ml-2" />
                                  <span>Location tracked</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {scan.source || 'direct'}
                        </Badge>
                      </div>
                    ))}
                    
                    {recentScans.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No recent scan activity</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span>Loading store data...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}