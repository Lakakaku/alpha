'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Download,
  Upload,
  Calendar
} from 'lucide-react';

interface VerificationDatabase {
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

interface VerificationDashboardProps {
  businessId: string;
}

const statusConfig = {
  ready: {
    label: 'Ready for Download',
    variant: 'default' as const,
    icon: FileText,
    color: 'text-blue-600'
  },
  downloaded: {
    label: 'Downloaded',
    variant: 'secondary' as const,
    icon: Download,
    color: 'text-purple-600'
  },
  submitted: {
    label: 'Submitted',
    variant: 'default' as const,
    icon: Upload,
    color: 'text-green-600'
  },
  processed: {
    label: 'Processed',
    variant: 'default' as const,
    icon: CheckCircle,
    color: 'text-green-700'
  },
  expired: {
    label: 'Expired',
    variant: 'destructive' as const,
    icon: AlertCircle,
    color: 'text-red-600'
  }
};

export function VerificationDashboard({ businessId }: VerificationDashboardProps) {
  const [databases, setDatabases] = useState<VerificationDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVerificationDatabases();
  }, [businessId]);

  const loadVerificationDatabases = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/business/verification/databases', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('business_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load verification databases: ${response.statusText}`);
      }

      const data = await response.json();
      setDatabases(data);
    } catch (err) {
      console.error('Error loading verification databases:', err);
      setError(err instanceof Error ? err.message : 'Failed to load verification databases');
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

  const getUrgencyLevel = (daysUntil: number): 'urgent' | 'warning' | 'normal' => {
    if (daysUntil <= 1) return 'urgent';
    if (daysUntil <= 2) return 'warning';
    return 'normal';
  };

  const renderStatusBadge = (status: VerificationDatabase['status']) => {
    const config = statusConfig[status];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon size={12} />
        {config.label}
      </Badge>
    );
  };

  const renderDeadlineInfo = (deadline: string) => {
    const daysUntil = getDaysUntilDeadline(deadline);
    const urgency = getUrgencyLevel(daysUntil);
    
    if (daysUntil < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <AlertCircle size={14} />
          <span className="text-sm font-medium">Expired</span>
        </div>
      );
    }

    const urgencyColors = {
      urgent: 'text-red-600',
      warning: 'text-amber-600',
      normal: 'text-green-600'
    };

    return (
      <div className={`flex items-center gap-1 ${urgencyColors[urgency]}`}>
        <Clock size={14} />
        <span className="text-sm font-medium">
          {daysUntil === 0 ? 'Due today' : `${daysUntil} day${daysUntil > 1 ? 's' : ''} left`}
        </span>
      </div>
    );
  };

  const getSummaryStats = () => {
    const total = databases.length;
    const ready = databases.filter(db => db.status === 'ready').length;
    const submitted = databases.filter(db => db.status === 'submitted' || db.status === 'processed').length;
    const expired = databases.filter(db => db.status === 'expired').length;
    
    return { total, ready, submitted, expired };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading verification databases...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-red-700">
          {error}
          <Button 
            variant="link" 
            className="ml-2 h-auto p-0 text-red-700 underline"
            onClick={loadVerificationDatabases}
          >
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const stats = getSummaryStats();

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Databases</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ready for Review</p>
                <p className="text-2xl font-bold text-blue-600">{stats.ready}</p>
              </div>
              <Download className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.submitted}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Expired</p>
                <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Verification Databases List */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Databases</CardTitle>
          <CardDescription>
            Review and verify transaction data for your stores
          </CardDescription>
        </CardHeader>
        <CardContent>
          {databases.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No verification databases</h3>
              <p className="text-gray-600">
                No verification databases are currently available for your business.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {databases.map((database) => (
                <Card key={database.id} className="border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium text-gray-900">{database.store_name}</h4>
                          {renderStatusBadge(database.status)}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <FileText size={14} />
                            <span>{database.transaction_count} transactions</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>Created {new Date(database.created_at).toLocaleDateString()}</span>
                          </div>
                          
                          {database.status !== 'expired' && (
                            <div>{renderDeadlineInfo(database.deadline_at)}</div>
                          )}
                        </div>

                        {/* Verification Progress */}
                        {(database.verified_count !== undefined || database.fake_count !== undefined) && (
                          <div className="mt-3 p-3 bg-gray-50 rounded">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div className="text-center">
                                <div className="font-medium text-green-600">{database.verified_count || 0}</div>
                                <div className="text-gray-600">Verified</div>
                              </div>
                              <div className="text-center">
                                <div className="font-medium text-red-600">{database.fake_count || 0}</div>
                                <div className="text-gray-600">Flagged</div>
                              </div>
                              <div className="text-center">
                                <div className="font-medium text-gray-600">{database.unverified_count || 0}</div>
                                <div className="text-gray-600">Pending</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        {database.status === 'ready' && (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => window.location.href = `/verification/databases/${database.id}`}
                          >
                            Start Review
                          </Button>
                        )}
                        
                        {database.status === 'downloaded' && (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => window.location.href = `/verification/databases/${database.id}`}
                          >
                            Continue Review
                          </Button>
                        )}
                        
                        {(database.status === 'submitted' || database.status === 'processed') && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.location.href = `/verification/databases/${database.id}`}
                          >
                            View Details
                          </Button>
                        )}
                        
                        {database.status === 'expired' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            disabled
                          >
                            Expired
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default VerificationDashboard;