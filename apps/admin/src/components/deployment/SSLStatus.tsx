'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@vocilia/ui';
import { Badge } from '@vocilia/ui';
import { Button } from '@vocilia/ui';
import { Shield, CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw, ExternalLink } from 'lucide-react';

interface SSLCertificate {
  certificate_id: string;
  domain: string;
  platform: 'Railway' | 'Vercel';
  certificate_authority: string;
  status: 'active' | 'pending' | 'expired' | 'failed';
  issued_at: string;
  expires_at: string;
  auto_renewal: boolean;
  last_renewal_attempt?: string;
  certificate_hash: string;
}

interface SSLSummary {
  total_certificates: number;
  active_certificates: number;
  expiring_soon: number;
  failed_renewals: number;
  auto_renewal_enabled: number;
}

export default function SSLStatus() {
  const [certificates, setCertificates] = useState<SSLCertificate[]>([]);
  const [summary, setSummary] = useState<SSLSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSSLStatus = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/admin/deployment/ssl-status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch SSL status');
      }

      const data = await response.json();
      setCertificates(data.certificates || []);
      setSummary(data.summary || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSSLStatus();
    // Refresh every 5 minutes
    const interval = setInterval(fetchSSLStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: SSLCertificate['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'expired':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Shield className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: SSLCertificate['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlatformColor = (platform: SSLCertificate['platform']) => {
    switch (platform) {
      case 'Railway':
        return 'bg-blue-100 text-blue-800';
      case 'Vercel':
        return 'bg-black text-white';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isExpiringSoon = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 30; // Expiring within 30 days
  };

  const isDanger = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 7; // Expiring within 7 days
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry;
  };

  const renewCertificate = async (certificateId: string, domain: string) => {
    if (!confirm(`Are you sure you want to renew the SSL certificate for ${domain}?`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/deployment/ssl-renew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        },
        body: JSON.stringify({
          certificate_id: certificateId,
          reason: 'Manual renewal from admin dashboard',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate SSL renewal');
      }

      // Refresh SSL status
      fetchSSLStatus();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to initiate SSL renewal');
    }
  };

  const testSSLConnection = async (domain: string) => {
    try {
      // Open SSL test in new tab
      window.open(`https://www.ssllabs.com/ssltest/analyze.html?d=${domain}`, '_blank');
    } catch (err) {
      alert('Failed to open SSL test');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SSL Certificate Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Certificates</p>
                  <p className="text-2xl font-bold text-blue-600">{summary.total_certificates}</p>
                </div>
                <Shield className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">{summary.active_certificates}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
                  <p className={`text-2xl font-bold ${
                    summary.expiring_soon > 0 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {summary.expiring_soon}
                  </p>
                </div>
                <AlertTriangle className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Failed Renewals</p>
                  <p className={`text-2xl font-bold ${
                    summary.failed_renewals > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {summary.failed_renewals}
                  </p>
                </div>
                <XCircle className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Auto Renewal</p>
                  <p className="text-2xl font-bold text-purple-600">{summary.auto_renewal_enabled}</p>
                </div>
                <RefreshCw className="w-5 h-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>SSL Certificate Status</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSSLStatus}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
      </Card>

      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <XCircle className="w-5 h-5 text-red-400 mr-2" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Certificate List */}
      <Card>
        <CardHeader>
          <CardTitle>SSL Certificates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {certificates.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No SSL certificates found</p>
            ) : (
              certificates.map((cert) => (
                <div
                  key={cert.certificate_id}
                  className={`border rounded-lg p-4 space-y-3 ${
                    isDanger(cert.expires_at) ? 'border-red-200 bg-red-50' :
                    isExpiringSoon(cert.expires_at) ? 'border-yellow-200 bg-yellow-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(cert.status)}
                      <div>
                        <h4 className="font-medium">{cert.domain}</h4>
                        <p className="text-sm text-gray-500">
                          {cert.certificate_authority}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getPlatformColor(cert.platform)}>
                        {cert.platform}
                      </Badge>
                      <Badge className={getStatusColor(cert.status)}>
                        {cert.status}
                      </Badge>
                      {cert.auto_renewal && (
                        <Badge variant="outline">
                          Auto Renewal
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Issued</p>
                      <p className="font-medium">{new Date(cert.issued_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Expires</p>
                      <p className={`font-medium ${
                        isDanger(cert.expires_at) ? 'text-red-600' :
                        isExpiringSoon(cert.expires_at) ? 'text-yellow-600' : ''
                      }`}>
                        {new Date(cert.expires_at).toLocaleDateString()}
                        <span className="text-xs ml-1">
                          ({getDaysUntilExpiry(cert.expires_at)} days)
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Last Renewal</p>
                      <p className="font-medium">
                        {cert.last_renewal_attempt 
                          ? new Date(cert.last_renewal_attempt).toLocaleDateString()
                          : 'Never'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Certificate Hash</p>
                      <p className="font-mono text-xs">{cert.certificate_hash.substring(0, 8)}...</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testSSLConnection(cert.domain)}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Test SSL
                    </Button>
                    {cert.status === 'active' && (isExpiringSoon(cert.expires_at) || !cert.auto_renewal) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => renewCertificate(cert.certificate_id, cert.domain)}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Renew
                      </Button>
                    )}
                  </div>

                  {isDanger(cert.expires_at) && (
                    <div className="bg-red-100 border border-red-200 rounded-md p-3">
                      <p className="text-red-800 text-sm">
                        <AlertTriangle className="w-4 h-4 inline mr-1" />
                        This certificate expires in {getDaysUntilExpiry(cert.expires_at)} days! 
                        Immediate action required.
                      </p>
                    </div>
                  )}

                  {isExpiringSoon(cert.expires_at) && !isDanger(cert.expires_at) && (
                    <div className="bg-yellow-100 border border-yellow-200 rounded-md p-3">
                      <p className="text-yellow-800 text-sm">
                        <Clock className="w-4 h-4 inline mr-1" />
                        This certificate expires in {getDaysUntilExpiry(cert.expires_at)} days. 
                        Consider renewing soon.
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}