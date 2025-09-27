'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Alert, AlertDescription } from '@vocilia/ui';
// TODO: Add Tabs component to @vocilia/ui
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vocilia/ui';
import { 
  QrCode, 
  Activity, 
  Settings, 
  Palette,
  Zap,
  AlertCircle,
  TrendingUp,
  Store,
  Users
} from 'lucide-react';
import { QRManagementDashboard } from '@/components/qr/QRManagementDashboard';
import { QRAnalyticsCharts } from '@/components/qr/QRAnalyticsCharts';
import { BulkQROperations } from '@/components/qr/BulkQROperations';
import { TemplateManager } from '@/components/qr/TemplateManager';
import { useQRService } from '@/services/qr/qr-client.service';
import { useBusinessAuth } from '@/hooks/use-business-auth';
import { toast } from '@/hooks/use-toast';

/**
 * QR Management Main Page
 * 
 * Central hub for all QR code management functionality.
 * Provides tabbed interface with overview, analytics, bulk operations, and templates.
 * 
 * Features:
 * - Comprehensive QR management dashboard
 * - Real-time analytics and insights
 * - Bulk operations for multiple stores
 * - Template management interface
 * - Store selection and filtering
 * - Performance metrics overview
 */
export default function QRManagementPage() {
  const router = useRouter();
  const { business, activeStore, stores } = useBusinessAuth();
  const {
    stores: qrStores,
    analytics,
    templates,
    loading,
    error,
    refreshStores,
    regenerateQR,
    downloadQR,
    bulkRegenerate,
    bulkDownload,
    getAnalytics,
    createTemplate,
    updateTemplate,
    deleteTemplate
  } = useQRService();

  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(activeStore?.id);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'quarter' | 'year'>('week');

  // Initialize data on mount
  useEffect(() => {
    if (business?.id) {
      refreshStores();
      if (selectedStoreId) {
        getAnalytics(selectedStoreId, dateRange);
      }
    }
  }, [business?.id, selectedStoreId, dateRange]);

  // Update selected store when active store changes
  useEffect(() => {
    if (activeStore?.id && selectedStoreId !== activeStore.id) {
      setSelectedStoreId(activeStore.id);
    }
  }, [activeStore?.id]);

  // Handle tab navigation from URL
  useEffect(() => {
    const tab = router.query.tab as string;
    if (tab && ['overview', 'analytics', 'bulk', 'templates'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [router.query.tab]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.push({ pathname: '/qr', query: { tab } }, undefined, { shallow: true });
  };

  const handleStoreSelect = (storeId: string) => {
    setSelectedStoreId(storeId);
    getAnalytics(storeId, dateRange);
  };

  const handleRegenerateQR = async (storeId: string) => {
    try {
      await regenerateQR(storeId);
      await refreshStores();
    } catch (error) {
      // Error handled by service
    }
  };

  const handleDownloadQR = async (storeId: string, format: 'pdf' | 'png' | 'svg') => {
    try {
      await downloadQR(storeId, format);
    } catch (error) {
      // Error handled by service
    }
  };

  const handleBulkRegenerate = async (storeIds: string[]) => {
    try {
      const result = await bulkRegenerate(storeIds);
      await refreshStores();
      return result;
    } catch (error) {
      throw error;
    }
  };

  const handleBulkDownload = async (storeIds: string[], format: 'pdf' | 'png' | 'svg') => {
    try {
      return await bulkDownload(storeIds, format);
    } catch (error) {
      throw error;
    }
  };

  const handleDateRangeChange = (range: string) => {
    setDateRange(range as typeof dateRange);
    if (selectedStoreId) {
      getAnalytics(selectedStoreId, range as typeof dateRange);
    }
  };

  // Calculate overview metrics
  const totalScans = qrStores.reduce((sum, store) => sum + (store.scanCount || 0), 0);
  const activeStores = qrStores.filter(store => store.status === 'active').length;
  const totalStores = qrStores.length;
  const avgScansPerStore = totalStores > 0 ? Math.round(totalScans / totalStores) : 0;

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
            Error loading QR data: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">QR Code Management</h1>
          <p className="text-gray-600">
            Manage QR codes for {business.businessName}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push('/qr/settings')}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Stores</p>
                <p className="text-2xl font-bold">{totalStores}</p>
              </div>
              <Store className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active QR Codes</p>
                <p className="text-2xl font-bold">{activeStores}</p>
              </div>
              <QrCode className="h-8 w-8 text-green-600" />
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
              <Activity className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg. per Store</p>
                <p className="text-2xl font-bold">{avgScansPerStore}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Bulk Operations
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <QRManagementDashboard
            stores={qrStores}
            selectedStoreId={selectedStoreId}
            analytics={analytics}
            onStoreSelect={handleStoreSelect}
            onRegenerateQR={handleRegenerateQR}
            onDownloadQR={handleDownloadQR}
            onBulkRegenerate={handleBulkRegenerate}
            onRefreshData={refreshStores}
          />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          {selectedStoreId ? (
            <QRAnalyticsCharts
              analytics={analytics}
              storeId={selectedStoreId}
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
              onExportData={async (type) => {
                // TODO: Implement export functionality
                toast({
                  title: "Export Started",
                  description: `Exporting analytics data as ${type.toUpperCase()}...`,
                });
              }}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Select a Store</h3>
                  <p>Choose a store from the overview to view detailed analytics.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Bulk Operations Tab */}
        <TabsContent value="bulk">
          <BulkQROperations
            stores={qrStores}
            onBulkRegenerate={handleBulkRegenerate}
            onBulkDownload={handleBulkDownload}
            onBulkExport={async (storeIds, format) => {
              // TODO: Implement bulk export functionality
              toast({
                title: "Export Started",
                description: `Exporting data for ${storeIds.length} stores as ${format.toUpperCase()}...`,
              });
            }}
          />
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <TemplateManager
            templates={templates}
            onCreateTemplate={createTemplate}
            onUpdateTemplate={updateTemplate}
            onDeleteTemplate={deleteTemplate}
            onDuplicateTemplate={async (id, name) => {
              // TODO: Implement duplicate functionality
              const template = templates.find(t => t.id === id);
              if (template) {
                const duplicated = {
                  ...template,
                  id: undefined,
                  name: name || `${template.name} (Copy)`,
                  createdAt: undefined,
                  updatedAt: undefined
                };
                return await createTemplate(duplicated);
              }
              throw new Error('Template not found');
            }}
            onPreviewTemplate={async (id, storeId) => {
              // TODO: Implement preview functionality
              toast({
                title: "Preview Generated",
                description: "Template preview is being generated...",
              });
              return '/placeholder-preview.png';
            }}
            onExportTemplate={async (id) => {
              // TODO: Implement export functionality
              toast({
                title: "Export Started",
                description: "Template export has started...",
              });
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span>Loading QR data...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}