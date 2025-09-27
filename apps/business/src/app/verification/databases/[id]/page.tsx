'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Download, 
  Upload, 
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

import VerificationFileDownload from '../../../../components/verification/VerificationFileDownload';
import VerificationSubmission from '../../../../components/verification/VerificationSubmission';
import VerificationRecordsTable from '../../../../components/verification/VerificationRecordsTable';

interface VerificationDatabaseDetail {
  id: string;
  store_id: string;
  store_name: string;
  transaction_count: number;
  status: 'ready' | 'downloaded' | 'submitted' | 'processed' | 'expired';
  deadline_at: string;
  created_at: string;
  verified_count?: number;
  fake_count?: number;
  unverified_count?: number;
  available_formats?: string[];
}

const statusConfig = {
  ready: {
    label: 'Ready for Download',
    variant: 'default' as const,
    icon: FileText,
    color: 'text-blue-600',
    description: 'Database is prepared and ready for download'
  },
  downloaded: {
    label: 'Downloaded',
    variant: 'secondary' as const,
    icon: Download,
    color: 'text-purple-600',
    description: 'Database has been downloaded and is ready for review'
  },
  submitted: {
    label: 'Submitted',
    variant: 'default' as const,
    icon: Upload,
    color: 'text-green-600',
    description: 'Verification results have been submitted'
  },
  processed: {
    label: 'Processed',
    variant: 'default' as const,
    icon: CheckCircle,
    color: 'text-green-700',
    description: 'Verification has been processed and rewards calculated'
  },
  expired: {
    label: 'Expired',
    variant: 'destructive' as const,
    icon: AlertCircle,
    color: 'text-red-600',
    description: 'Deadline has passed for this verification'
  }
};

export default function VerificationDatabaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const databaseId = params.id as string;

  const [database, setDatabase] = useState<VerificationDatabaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (databaseId) {
      loadDatabaseDetails();
    }
  }, [databaseId]);

  const loadDatabaseDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/business/verification/databases/${databaseId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('business_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load database details: ${response.statusText}`);
      }

      const data = await response.json();
      setDatabase(data);

      // Set appropriate tab based on status
      if (data.status === 'ready') {
        setActiveTab('download');
      } else if (data.status === 'downloaded') {
        setActiveTab('review');
      } else if (data.status === 'submitted' || data.status === 'processed') {
        setActiveTab('review');
      }

    } catch (err) {
      console.error('Error loading database details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load database details');
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntilDeadline = (deadlineAt: string): number => {
    const deadline = new Date(deadlineAt);
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleDownloadStart = (format: string) => {
    console.log(`Started downloading ${format} format`);
  };

  const handleDownloadComplete = (format: string) => {
    console.log(`Completed downloading ${format} format`);
    // Reload database details to update status
    loadDatabaseDetails();
  };

  const handleSubmissionComplete = (result: any) => {
    console.log('Verification submitted:', result);
    // Reload database details to update status
    loadDatabaseDetails();
  };

  const handleRecordsUpdate = (updatedCount: number) => {
    console.log(`Updated ${updatedCount} records`);
    // Reload database details to get updated counts
    loadDatabaseDetails();
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading database details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !database) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="mb-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back
          </Button>
        </div>

        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-700">
            {error || 'Database not found'}
            <Button 
              variant="link" 
              className="ml-2 h-auto p-0 text-red-700 underline"
              onClick={loadDatabaseDetails}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const statusInfo = statusConfig[database.status];
  const StatusIcon = statusInfo.icon;
  const daysUntilDeadline = getDaysUntilDeadline(database.deadline_at);
  const isExpired = daysUntilDeadline < 0;

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back
          </Button>
          
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{database.store_name}</h1>
            <p className="text-gray-600">Verification Database</p>
          </div>

          <Badge variant={statusInfo.variant} className="flex items-center gap-1">
            <StatusIcon size={14} />
            {statusInfo.label}
          </Badge>
        </div>

        {/* Database Summary */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{database.transaction_count}</div>
                <div className="text-sm text-gray-600">Total Transactions</div>
              </div>
              
              {database.verified_count !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{database.verified_count}</div>
                  <div className="text-sm text-gray-600">Verified</div>
                </div>
              )}
              
              {database.fake_count !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{database.fake_count}</div>
                  <div className="text-sm text-gray-600">Marked as Fake</div>
                </div>
              )}
              
              <div className="text-center">
                <div className={`text-2xl font-bold ${isExpired ? 'text-red-600' : 'text-gray-600'}`}>
                  {isExpired ? 'Expired' : `${daysUntilDeadline} day${daysUntilDeadline !== 1 ? 's' : ''}`}
                </div>
                <div className="text-sm text-gray-600">
                  {isExpired ? 'Past deadline' : 'Until deadline'}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Calendar size={14} />
                  <span>Created: {new Date(database.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>Deadline: {new Date(database.deadline_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Alert */}
      {database.status === 'expired' && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-700">
            This verification database has expired. You can still view the details but cannot make changes.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger 
            value="download" 
            disabled={database.status === 'expired'}
          >
            Download Files
          </TabsTrigger>
          <TabsTrigger value="review">Review & Submit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Database Information</CardTitle>
              <CardDescription>
                Overview of your verification database and current status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Current Status</h4>
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
                    <span className="font-medium">{statusInfo.label}</span>
                    <span className="text-gray-600">- {statusInfo.description}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Available Formats</h4>
                  <div className="flex gap-2">
                    {(database.available_formats || ['csv', 'excel', 'json']).map(format => (
                      <Badge key={format} variant="outline">{format.toUpperCase()}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Next Steps</h4>
                  <div className="text-sm text-gray-600">
                    {database.status === 'ready' && (
                      <p>Download the verification database files and begin reviewing transactions.</p>
                    )}
                    {database.status === 'downloaded' && (
                      <p>Review individual transactions and mark them as verified or fake, then submit your results.</p>
                    )}
                    {database.status === 'submitted' && (
                      <p>Your verification has been submitted and is being processed.</p>
                    )}
                    {database.status === 'processed' && (
                      <p>Verification complete. Rewards have been calculated and invoices generated.</p>
                    )}
                    {database.status === 'expired' && (
                      <p>This verification has expired. Contact support if you need assistance.</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="download" className="mt-6">
          <VerificationFileDownload
            databaseId={databaseId}
            availableFormats={database.available_formats}
            onDownloadStart={handleDownloadStart}
            onDownloadComplete={handleDownloadComplete}
          />
        </TabsContent>

        <TabsContent value="review" className="mt-6">
          <div className="space-y-6">
            <VerificationRecordsTable
              databaseId={databaseId}
              readOnly={database.status === 'submitted' || database.status === 'processed' || database.status === 'expired'}
              onRecordsUpdate={handleRecordsUpdate}
            />

            {database.status === 'downloaded' && (
              <VerificationSubmission
                databaseId={databaseId}
                onSubmissionComplete={handleSubmissionComplete}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}