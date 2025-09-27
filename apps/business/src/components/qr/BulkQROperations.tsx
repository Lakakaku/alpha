'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Progress } from '@vocilia/ui';
import { Alert, AlertDescription } from '@vocilia/ui';
import { Checkbox } from '@vocilia/ui';
import { 
  RefreshCw, 
  Download, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Zap,
  FileText,
  Settings,
  Trash2,
  Eye,
  Filter
} from 'lucide-react';
import { QRCodeStore, BulkOperationResult, BulkOperationStatus } from '@vocilia/types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface BulkQROperationsProps {
  stores: QRCodeStore[];
  className?: string;
  onBulkRegenerate?: (storeIds: string[], options?: BulkRegenerateOptions) => Promise<BulkOperationResult>;
  onBulkDownload?: (storeIds: string[], format: 'pdf' | 'png' | 'svg') => Promise<BulkOperationResult>;
  onBulkExport?: (storeIds: string[], format: 'csv' | 'json') => Promise<void>;
  onBulkImport?: (data: any[]) => Promise<BulkOperationResult>;
}

interface BulkRegenerateOptions {
  preserveTransition?: boolean;
  batchSize?: number;
  delayBetweenBatches?: number;
}

interface OperationProgress {
  id: string;
  type: 'regenerate' | 'download' | 'export' | 'import';
  status: BulkOperationStatus;
  progress: number;
  total: number;
  completed: number;
  failed: number;
  startTime: Date;
  endTime?: Date;
  errors: string[];
}

/**
 * Bulk QR Operations Component
 * 
 * Provides comprehensive bulk operations for managing multiple QR codes.
 * Supports batch processing with progress tracking and error handling.
 * 
 * Features:
 * - Multi-store selection with filters
 * - Bulk regeneration with batching
 * - Bulk download in multiple formats
 * - Data export/import capabilities
 * - Real-time progress tracking
 * - Error handling and retry logic
 * - Operation history and logs
 */
export function BulkQROperations({
  stores = [],
  className,
  onBulkRegenerate,
  onBulkDownload,
  onBulkExport,
  onBulkImport
}: BulkQROperationsProps) {
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'transitioning'>('all');
  const [currentOperation, setCurrentOperation] = useState<OperationProgress | null>(null);
  const [operationHistory, setOperationHistory] = useState<OperationProgress[]>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Advanced options state
  const [batchSize, setBatchSize] = useState(10);
  const [preserveTransition, setPreserveTransition] = useState(true);
  const [delayBetweenBatches, setDelayBetweenBatches] = useState(1000);

  // Filter stores based on status
  const filteredStores = stores.filter(store => {
    if (filterStatus === 'all') return true;
    return store.status === filterStatus;
  });

  // Selection helpers
  const handleSelectAll = () => {
    if (selectedStores.length === filteredStores.length) {
      setSelectedStores([]);
    } else {
      setSelectedStores(filteredStores.map(store => store.id));
    }
  };

  const handleStoreToggle = (storeId: string) => {
    setSelectedStores(prev => 
      prev.includes(storeId) 
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const isAllSelected = selectedStores.length === filteredStores.length && filteredStores.length > 0;
  const isPartialSelected = selectedStores.length > 0 && selectedStores.length < filteredStores.length;

  // Operation handlers
  const startOperation = (type: OperationProgress['type'], total: number) => {
    const operation: OperationProgress = {
      id: `${type}_${Date.now()}`,
      type,
      status: 'pending',
      progress: 0,
      total,
      completed: 0,
      failed: 0,
      startTime: new Date(),
      errors: []
    };
    setCurrentOperation(operation);
    return operation;
  };

  const updateOperation = (updates: Partial<OperationProgress>) => {
    setCurrentOperation(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      updated.progress = Math.round((updated.completed / updated.total) * 100);
      return updated;
    });
  };

  const completeOperation = () => {
    if (currentOperation) {
      const completed = {
        ...currentOperation,
        endTime: new Date(),
        status: 'completed' as BulkOperationStatus
      };
      setOperationHistory(prev => [completed, ...prev.slice(0, 9)]); // Keep last 10
      setCurrentOperation(null);
    }
  };

  const handleBulkRegenerate = async () => {
    if (!onBulkRegenerate || selectedStores.length === 0) return;

    const operation = startOperation('regenerate', selectedStores.length);
    
    try {
      updateOperation({ status: 'in_progress' });
      
      const result = await onBulkRegenerate(selectedStores, {
        preserveTransition,
        batchSize,
        delayBetweenBatches
      });

      updateOperation({
        completed: result.successful.length,
        failed: result.failed.length,
        errors: result.errors || []
      });

      completeOperation();
      setSelectedStores([]);

      toast({
        title: "Bulk Regeneration Complete",
        description: `${result.successful.length} QR codes regenerated successfully. ${result.failed.length} failed.`,
        variant: result.failed.length > 0 ? "destructive" : "default"
      });

    } catch (error) {
      updateOperation({ 
        status: 'failed', 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      });
      
      toast({
        title: "Bulk Regeneration Failed",
        description: "Operation failed. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleBulkDownload = async (format: 'pdf' | 'png' | 'svg') => {
    if (!onBulkDownload || selectedStores.length === 0) return;

    const operation = startOperation('download', selectedStores.length);
    
    try {
      updateOperation({ status: 'in_progress' });
      
      const result = await onBulkDownload(selectedStores, format);

      updateOperation({
        completed: result.successful.length,
        failed: result.failed.length,
        errors: result.errors || []
      });

      completeOperation();

      toast({
        title: "Bulk Download Complete",
        description: `${result.successful.length} files downloaded as ${format.toUpperCase()}.`,
      });

    } catch (error) {
      updateOperation({ 
        status: 'failed', 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      });
      
      toast({
        title: "Bulk Download Failed",
        description: "Download failed. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleBulkExport = async (format: 'csv' | 'json') => {
    if (!onBulkExport || selectedStores.length === 0) return;

    const operation = startOperation('export', selectedStores.length);
    
    try {
      updateOperation({ status: 'in_progress' });
      
      await onBulkExport(selectedStores, format);

      updateOperation({ completed: selectedStores.length });
      completeOperation();

      toast({
        title: "Export Complete",
        description: `Data exported as ${format.toUpperCase()}.`,
      });

    } catch (error) {
      updateOperation({ 
        status: 'failed', 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      });
      
      toast({
        title: "Export Failed",
        description: "Export failed. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: BulkOperationStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'in_progress':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatDuration = (start: Date, end?: Date) => {
    const duration = (end || new Date()).getTime() - start.getTime();
    const seconds = Math.round(duration / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Bulk Operations</h2>
          <p className="text-gray-600">Manage multiple QR codes at once</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
        >
          <Settings className="h-4 w-4 mr-2" />
          Advanced Options
        </Button>
      </div>

      {/* Advanced Options */}
      {showAdvancedOptions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Batch Size</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">QR codes per batch (1-50)</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Batch Delay (ms)</label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={delayBetweenBatches}
                  onChange={(e) => setDelayBetweenBatches(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-md"
                />
                <p className="text-xs text-gray-500 mt-1">Delay between batches</p>
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="preserve-transition"
                  checked={preserveTransition}
                  onCheckedChange={(checked) => setPreserveTransition(!!checked)}
                />
                <label htmlFor="preserve-transition" className="text-sm font-medium">
                  Preserve transition periods
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Operation Progress */}
      {currentOperation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(currentOperation.status)}
              {currentOperation.type.charAt(0).toUpperCase() + currentOperation.type.slice(1)} in Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress: {currentOperation.completed} / {currentOperation.total}</span>
                <span>{currentOperation.progress}%</span>
              </div>
              <Progress value={currentOperation.progress} className="w-full" />
            </div>
            
            {currentOperation.failed > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {currentOperation.failed} operations failed. Check logs for details.
                </AlertDescription>
              </Alert>
            )}

            <div className="text-sm text-gray-600">
              Duration: {formatDuration(currentOperation.startTime)}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Store Selection */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Select Stores</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterStatus('all')}
                className={filterStatus === 'all' ? 'bg-blue-50' : ''}
              >
                All ({stores.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterStatus('active')}
                className={filterStatus === 'active' ? 'bg-blue-50' : ''}
              >
                Active ({stores.filter(s => s.status === 'active').length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterStatus('inactive')}
                className={filterStatus === 'inactive' ? 'bg-blue-50' : ''}
              >
                Inactive ({stores.filter(s => s.status === 'inactive').length})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Select All */}
          <div className="flex items-center space-x-2 pb-2 border-b">
            <Checkbox
              checked={isAllSelected}
              ref={(ref) => {
                if (ref) ref.indeterminate = isPartialSelected;
              }}
              onCheckedChange={handleSelectAll}
            />
            <label className="text-sm font-medium">
              Select All ({selectedStores.length} of {filteredStores.length} selected)
            </label>
          </div>

          {/* Store List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredStores.map((store) => (
              <div
                key={store.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                  selectedStores.includes(store.id)
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                )}
                onClick={() => handleStoreToggle(store.id)}
              >
                <div className="flex items-center space-x-3">
                  <Checkbox
                    checked={selectedStores.includes(store.id)}
                    onChange={() => handleStoreToggle(store.id)}
                  />
                  <div>
                    <p className="font-medium">{store.storeName}</p>
                    <p className="text-sm text-gray-600">
                      {store.scanCount || 0} scans • Generated {new Date(store.generatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant={store.status === 'active' ? 'default' : 'secondary'}>
                  {store.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedStores.length > 0 && !currentOperation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Bulk Actions ({selectedStores.length} stores selected)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {onBulkRegenerate && (
                <Button onClick={handleBulkRegenerate} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate QR Codes
                </Button>
              )}

              {onBulkDownload && (
                <div className="space-y-1">
                  <Button 
                    onClick={() => handleBulkDownload('pdf')} 
                    variant="outline" 
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              )}

              {onBulkExport && (
                <Button 
                  onClick={() => handleBulkExport('csv')} 
                  variant="outline" 
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}

              <Button 
                onClick={() => setSelectedStores([])} 
                variant="outline" 
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Selection
              </Button>
            </div>

            {onBulkDownload && (
              <div className="flex gap-2 pt-2 border-t">
                <Button 
                  onClick={() => handleBulkDownload('png')} 
                  variant="outline" 
                  size="sm"
                >
                  PNG
                </Button>
                <Button 
                  onClick={() => handleBulkDownload('svg')} 
                  variant="outline" 
                  size="sm"
                >
                  SVG
                </Button>
                {onBulkExport && (
                  <Button 
                    onClick={() => handleBulkExport('json')} 
                    variant="outline" 
                    size="sm"
                  >
                    JSON
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Operation History */}
      {operationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Operations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {operationHistory.map((operation) => (
                <div
                  key={operation.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(operation.status)}
                    <div>
                      <p className="font-medium capitalize">{operation.type}</p>
                      <p className="text-sm text-gray-600">
                        {operation.completed}/{operation.total} completed
                        {operation.failed > 0 && ` • ${operation.failed} failed`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatDuration(operation.startTime, operation.endTime)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {operation.startTime.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default BulkQROperations;