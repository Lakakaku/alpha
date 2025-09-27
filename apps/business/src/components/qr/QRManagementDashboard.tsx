'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Alert, AlertDescription } from '@vocilia/ui';
// TODO: Add Tabs component to @vocilia/ui
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@vocilia/ui';
import { 
  QrCode, 
  Download, 
  RefreshCw, 
  Settings, 
  Activity,
  Store,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  Zap
} from 'lucide-react';
import { QRCodeDisplay } from './QRCodeDisplay';
import { QRCodeStore, QRAnalytics } from '@vocilia/types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface QRManagementDashboardProps {
  stores: QRCodeStore[];
  selectedStoreId?: string;
  analytics?: QRAnalytics[];
  className?: string;
  onStoreSelect?: (storeId: string) => void;
  onRegenerateQR?: (storeId: string) => Promise<void>;
  onDownloadQR?: (storeId: string, format: 'pdf' | 'png' | 'svg') => Promise<void>;
  onBulkRegenerate?: (storeIds: string[]) => Promise<void>;
  onRefreshData?: () => Promise<void>;
}

/**
 * QR Management Dashboard Component
 * 
 * Comprehensive dashboard for managing QR codes across multiple stores.
 * Provides overview, individual store management, and bulk operations.
 * 
 * Features:
 * - Multi-store QR code overview
 * - Individual QR code management
 * - Real-time analytics integration
 * - Bulk operations support
 * - Status monitoring
 * - Quick actions and controls
 */
export function QRManagementDashboard({
  stores = [],
  selectedStoreId,
  analytics = [],
  className,
  onStoreSelect,
  onRegenerateQR,
  onDownloadQR,
  onBulkRegenerate,
  onRefreshData
}: QRManagementDashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'regenerate' | 'download' | null>(null);

  const selectedStore = stores.find(store => store.id === selectedStoreId) || stores[0];

  // Analytics calculations
  const totalScans = analytics.reduce((sum, a) => sum + (a.totalScans || 0), 0);
  const activeStores = stores.filter(store => store.status === 'active').length;
  const transitioningStores = stores.filter(store => store.status === 'transitioning').length;
  const inactiveStores = stores.filter(store => store.status === 'inactive').length;

  const handleRefresh = async () => {
    if (!onRefreshData) return;
    
    setIsRefreshing(true);
    try {
      await onRefreshData();
      toast({
        title: "Data Refreshed",
        description: "QR code data has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStoreToggle = (storeId: string) => {
    setSelectedStores(prev => 
      prev.includes(storeId) 
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const handleBulkRegenerate = async () => {
    if (!onBulkRegenerate || selectedStores.length === 0) return;
    
    setBulkAction('regenerate');
    try {
      await onBulkRegenerate(selectedStores);
      setSelectedStores([]);
      toast({
        title: "Bulk Regeneration Complete",
        description: `${selectedStores.length} QR codes have been regenerated.`,
      });
    } catch (error) {
      toast({
        title: "Bulk Regeneration Failed",
        description: "Some QR codes failed to regenerate. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBulkAction(null);
    }
  };

  const getStatusStats = () => [
    {
      label: 'Active',
      count: activeStores,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Transitioning',
      count: transitioningStores,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      label: 'Inactive',
      count: inactiveStores,
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ];

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">QR Code Management</h1>
          <p className="text-gray-600">Manage QR codes across all your stores</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn(
              "h-4 w-4 mr-2",
              isRefreshing && "animate-spin"
            )} />
            Refresh
          </Button>
          <Button>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Stores</p>
                <p className="text-2xl font-bold">{stores.length}</p>
              </div>
              <Store className="h-8 w-8 text-blue-600" />
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
                <p className="text-sm text-gray-600">Active QR Codes</p>
                <p className="text-2xl font-bold">{activeStores}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg. Daily Scans</p>
                <p className="text-2xl font-bold">
                  {Math.round(totalScans / Math.max(stores.length, 1))}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code Status Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {getStatusStats().map((stat) => (
              <div 
                key={stat.label}
                className={cn("p-4 rounded-lg border", stat.bgColor)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                    <p className={cn("text-xl font-bold", stat.color)}>{stat.count}</p>
                  </div>
                  <stat.icon className={cn("h-6 w-6", stat.color)} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="manage">Manage QR Codes</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Operations</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {selectedStore && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Selected Store QR Display */}
              <QRCodeDisplay
                store={selectedStore}
                showControls={true}
                onRegenerate={() => onRegenerateQR?.(selectedStore.id)}
                onDownload={(format) => onDownloadQR?.(selectedStore.id, format)}
                onPreview={() => onStoreSelect?.(selectedStore.id)}
              />

              {/* Store Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Store</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {stores.map((store) => (
                    <div
                      key={store.id}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedStore?.id === store.id 
                          ? "border-blue-500 bg-blue-50" 
                          : "border-gray-200 hover:border-gray-300"
                      )}
                      onClick={() => onStoreSelect?.(store.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{store.storeName}</p>
                          <p className="text-sm text-gray-600">
                            {store.scanCount || 0} scans
                          </p>
                        </div>
                        <Badge 
                          variant={store.status === 'active' ? 'default' : 'secondary'}
                        >
                          {store.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Manage QR Codes Tab */}
        <TabsContent value="manage" className="space-y-4">
          <div className="grid gap-4">
            {stores.map((store) => (
              <Card key={store.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-white border rounded p-2">
                        <QrCode className="w-full h-full text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{store.storeName}</h3>
                        <p className="text-sm text-gray-600">
                          Generated: {new Date(store.generatedAt).toLocaleDateString()}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={store.status === 'active' ? 'default' : 'secondary'}>
                            {store.status}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {store.scanCount || 0} scans
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRegenerateQR?.(store.id)}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Regenerate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDownloadQR?.(store.id, 'pdf')}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Bulk Operations Tab */}
        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Bulk Operations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedStores.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {selectedStores.length} store{selectedStores.length !== 1 ? 's' : ''} selected for bulk operations.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                {stores.map((store) => (
                  <div
                    key={store.id}
                    className={cn(
                      "p-4 rounded-lg border cursor-pointer transition-colors",
                      selectedStores.includes(store.id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                    onClick={() => handleStoreToggle(store.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedStores.includes(store.id)}
                          onChange={() => handleStoreToggle(store.id)}
                          className="rounded"
                        />
                        <div>
                          <p className="font-medium">{store.storeName}</p>
                          <p className="text-sm text-gray-600">
                            Status: {store.status} • {store.scanCount || 0} scans
                          </p>
                        </div>
                      </div>
                      <Badge variant={store.status === 'active' ? 'default' : 'secondary'}>
                        {store.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {selectedStores.length > 0 && (
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={handleBulkRegenerate}
                    disabled={bulkAction === 'regenerate'}
                    className="flex-1"
                  >
                    <RefreshCw className={cn(
                      "h-4 w-4 mr-2",
                      bulkAction === 'regenerate' && "animate-spin"
                    )} />
                    Regenerate Selected ({selectedStores.length})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedStores([])}
                  >
                    Clear Selection
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default QRManagementDashboard;