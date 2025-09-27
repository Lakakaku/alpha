'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { Button } from '@vocilia/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { 
  Download, 
  RefreshCw, 
  Eye, 
  Copy, 
  ExternalLink,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { QRCodeStore, QRCodeStatus } from '@vocilia/types';
import { cn } from '@/lib/utils';

interface QRCodeDisplayProps {
  store: QRCodeStore;
  showControls?: boolean;
  size?: number;
  className?: string;
  onRegenerate?: () => Promise<void>;
  onDownload?: (format: 'pdf' | 'png' | 'svg') => Promise<void>;
  onPreview?: () => void;
}

/**
 * QR Code Display Component
 * 
 * Displays QR codes with status information, controls, and analytics.
 * Supports multiple display modes and interactive features.
 * 
 * Features:
 * - Visual QR code rendering
 * - Status indicators and badges
 * - Download options (PDF, PNG, SVG)
 * - QR regeneration controls
 * - Analytics preview
 * - Copy to clipboard
 * - Responsive design
 */
export function QRCodeDisplay({ 
  store, 
  showControls = true,
  size = 200,
  className,
  onRegenerate,
  onDownload,
  onPreview
}: QRCodeDisplayProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // Reset copied state after delay
  useEffect(() => {
    if (copiedToClipboard) {
      const timer = setTimeout(() => setCopiedToClipboard(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedToClipboard]);

  const getStatusColor = (status: QRCodeStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'transitioning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: QRCodeStatus) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />;
      case 'transitioning':
        return <RefreshCw className="h-4 w-4" />;
      case 'inactive':
      case 'expired':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    
    setIsRegenerating(true);
    try {
      await onRegenerate();
      toast({
        title: "QR Code Regenerated",
        description: "New QR code has been generated successfully.",
      });
    } catch (error) {
      toast({
        title: "Regeneration Failed",
        description: "Failed to regenerate QR code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDownload = async (format: 'pdf' | 'png' | 'svg') => {
    if (!onDownload) return;
    
    setIsDownloading(true);
    try {
      await onDownload(format);
      toast({
        title: "Download Started",
        description: `QR code ${format.toUpperCase()} download has started.`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: `Failed to download QR code as ${format.toUpperCase()}.`,
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(store.qrCode);
      setCopiedToClipboard(true);
      toast({
        title: "Copied to Clipboard",
        description: "QR code content copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy QR code to clipboard.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className={cn("w-full max-w-md", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {store.storeName} QR Code
          </CardTitle>
          <Badge 
            variant="outline" 
            className={cn("flex items-center gap-1", getStatusColor(store.status))}
          >
            {getStatusIcon(store.status)}
            {store.status.charAt(0).toUpperCase() + store.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* QR Code Display */}
        <div className="flex justify-center">
          <div className="p-4 bg-white rounded-lg border shadow-sm">
            {store.qrCode ? (
              <QRCode
                value={store.qrCode}
                size={size}
                level="M"
                className="rounded"
              />
            ) : (
              <div 
                className="flex items-center justify-center bg-gray-100 rounded"
                style={{ width: size, height: size }}
              >
                <AlertTriangle className="h-8 w-8 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        {/* QR Code Information */}
        <div className="space-y-3">
          <div className="text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-600">QR Code:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyCode}
                className="h-6 px-2 text-xs"
              >
                <Copy className="h-3 w-3 mr-1" />
                {copiedToClipboard ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded block break-all">
              {store.qrCode}
            </code>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600 block">Generated:</span>
              <span className="font-medium">
                {formatDate(store.generatedAt)}
              </span>
            </div>
            {store.version && (
              <div>
                <span className="text-gray-600 block">Version:</span>
                <span className="font-medium">v{store.version}</span>
              </div>
            )}
          </div>

          {store.transitionEndsAt && (
            <div className="text-sm">
              <span className="text-gray-600 block">Transition Ends:</span>
              <span className="font-medium text-yellow-600">
                {formatDate(store.transitionEndsAt)}
              </span>
            </div>
          )}
        </div>

        {/* Analytics Summary */}
        {store.scanCount !== undefined && (
          <div className="flex items-center justify-between text-sm p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <span className="text-gray-600">Total Scans:</span>
            </div>
            <span className="font-semibold text-blue-600">
              {store.scanCount.toLocaleString()}
            </span>
          </div>
        )}

        {/* Control Buttons */}
        {showControls && (
          <div className="space-y-3">
            {/* Primary Actions */}
            <div className="flex gap-2">
              {onRegenerate && (
                <Button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="flex-1"
                  variant="outline"
                >
                  <RefreshCw className={cn(
                    "h-4 w-4 mr-2",
                    isRegenerating && "animate-spin"
                  )} />
                  {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                </Button>
              )}

              {onPreview && (
                <Button
                  onClick={onPreview}
                  variant="outline"
                  className="flex-1"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              )}
            </div>

            {/* Download Options */}
            {onDownload && (
              <div className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Download:</span>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDownload('pdf')}
                    disabled={isDownloading}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    PDF
                  </Button>
                  <Button
                    onClick={() => handleDownload('png')}
                    disabled={isDownloading}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    PNG
                  </Button>
                  <Button
                    onClick={() => handleDownload('svg')}
                    disabled={isDownloading}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    SVG
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Links */}
        <div className="pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-blue-600 hover:text-blue-800"
            onClick={() => window.open(`/analytics/${store.id}`, '_blank')}
          >
            <ExternalLink className="h-3 w-3 mr-2" />
            View Detailed Analytics
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default QRCodeDisplay;