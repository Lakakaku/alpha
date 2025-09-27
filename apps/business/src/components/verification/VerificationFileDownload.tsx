'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  FileCode,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';

interface VerificationFileDownloadProps {
  databaseId: string;
  availableFormats?: string[];
  onDownloadStart?: (format: string) => void;
  onDownloadComplete?: (format: string) => void;
}

interface DownloadUrl {
  download_url: string;
  expires_at: string;
  filename: string;
}

const formatConfig = {
  csv: {
    name: 'CSV',
    description: 'Comma-separated values file for Excel or spreadsheet applications',
    icon: FileText,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  excel: {
    name: 'Excel',
    description: 'Microsoft Excel workbook with formatted data',
    icon: FileSpreadsheet,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  json: {
    name: 'JSON',
    description: 'JavaScript Object Notation for programmatic processing',
    icon: FileCode,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200'
  }
};

export function VerificationFileDownload({ 
  databaseId, 
  availableFormats = ['csv', 'excel', 'json'],
  onDownloadStart,
  onDownloadComplete
}: VerificationFileDownloadProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadedFormats, setDownloadedFormats] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (format: string) => {
    try {
      setDownloading(format);
      setError(null);
      onDownloadStart?.(format);

      // Get download URL from API
      const response = await fetch(`/api/business/verification/databases/${databaseId}/download/${format}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('business_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get download URL: ${response.statusText}`);
      }

      const downloadData: DownloadUrl = await response.json();

      // Create a temporary link to download the file
      const link = document.createElement('a');
      link.href = downloadData.download_url;
      link.download = downloadData.filename || `verification_${databaseId}.${format}`;
      link.target = '_blank';
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Mark format as downloaded
      setDownloadedFormats(prev => new Set([...prev, format]));
      onDownloadComplete?.(format);

    } catch (err) {
      console.error('Error downloading file:', err);
      setError(err instanceof Error ? err.message : 'Failed to download file');
    } finally {
      setDownloading(null);
    }
  };

  const getFormatStatus = (format: string) => {
    if (downloading === format) return 'downloading';
    if (downloadedFormats.has(format)) return 'downloaded';
    return 'available';
  };

  const renderFormatCard = (format: string) => {
    const config = formatConfig[format as keyof typeof formatConfig];
    if (!config) return null;

    const status = getFormatStatus(format);
    const Icon = config.icon;

    return (
      <Card 
        key={format} 
        className={`transition-all duration-200 hover:shadow-md ${config.borderColor} ${
          status === 'downloaded' ? config.bgColor : ''
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded ${config.bgColor}`}>
                <Icon className={`h-5 w-5 ${config.color}`} />
              </div>
              
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">{config.name}</h4>
                <p className="text-sm text-gray-600 mb-3">{config.description}</p>
                
                {status === 'downloaded' && (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle size={14} />
                    <span className="text-sm font-medium">Downloaded</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant={status === 'downloaded' ? 'outline' : 'default'}
                size="sm"
                onClick={() => handleDownload(format)}
                disabled={downloading !== null}
                className="min-w-[100px]"
              >
                {downloading === format ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    <span>Downloading...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Download size={14} />
                    <span>{status === 'downloaded' ? 'Download Again' : 'Download'}</span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Verification Database
          </CardTitle>
          <CardDescription>
            Choose your preferred format to download the verification database. 
            All formats contain the same transaction data for your review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {availableFormats.map(format => renderFormatCard(format))}
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Download Instructions
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• All files contain transaction times and amounts only (no personal data)</li>
              <li>• Review each transaction and mark as "verified" or "fake"</li>
              <li>• Return to this page to submit your verification results</li>
              <li>• Files expire 1 hour after download for security</li>
            </ul>
          </div>

          {/* Download History */}
          {downloadedFormats.size > 0 && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Download History
              </h4>
              <div className="text-sm text-green-800">
                <p>Successfully downloaded: {Array.from(downloadedFormats).map(f => formatConfig[f as keyof typeof formatConfig]?.name).join(', ')}</p>
                <p className="flex items-center gap-1 mt-1">
                  <Clock size={12} />
                  Downloaded at {new Date().toLocaleTimeString()}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default VerificationFileDownload;